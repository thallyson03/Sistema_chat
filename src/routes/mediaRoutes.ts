import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import axios from 'axios';
import crypto from 'crypto';

const router = Router();

// Rota para servir mídia descriptografada
router.get('/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;

  try {
    // Buscar mensagem no banco
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!message) {
      console.error('[Media] ❌ Mensagem não encontrada:', messageId);
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Verificar se é mensagem de mídia
    if (!['IMAGE', 'VIDEO', 'AUDIO'].includes(message.type)) {
      return res.status(400).json({ error: 'Mensagem não é de mídia' });
    }

    // Extrair informações de mídia do metadata
    const metadata = message.metadata as any;
    const mediaUrl = metadata?.mediaUrl;
    const mediaMetadata = metadata?.mediaMetadata || {};

    console.log('[Media] ============================================');
    console.log('[Media] Requisição de mídia recebida');
    console.log('[Media] MessageId:', messageId);
    console.log('[Media] MessageType:', message.type);
    console.log('[Media] HasMediaUrl:', !!mediaUrl);
    console.log('[Media] MediaUrl:', mediaUrl?.substring(0, 100));
    console.log('[Media] MediaMetadata keys:', Object.keys(mediaMetadata));
    console.log('[Media] HasMediaKey:', !!mediaMetadata?.mediaKey);
    console.log('[Media] ============================================');

    if (!mediaUrl) {
      console.error('[Media] ❌ URL de mídia não encontrada no metadata:', JSON.stringify(metadata, null, 2));
      return res.status(404).json({ error: 'URL de mídia não encontrada' });
    }

    // Verificar se é base64 (dados já estão no content)
    if (mediaUrl.startsWith('data:')) {
      const base64Data = mediaUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const contentType = mediaMetadata?.mimetype || 
                        (message.type === 'IMAGE' ? 'image/jpeg' : 
                         message.type === 'VIDEO' ? 'video/mp4' : 
                         'audio/ogg');
      
      console.log('[Media] ✅ Mídia base64 decodificada:', {
        size: buffer.length,
        contentType,
      });

      res.status(200);
      res.contentType(contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.write(buffer);
      res.end();
      return;
    }

    // Buscar token da instância para autenticação
    let instanceToken = message.conversation.channel.evolutionInstanceToken;
    
    // Se não encontrou no relacionamento, buscar diretamente do canal
    if (!instanceToken) {
      console.warn('[Media] ⚠️ Token não encontrado no relacionamento, buscando diretamente do canal...');
      const channel = await prisma.channel.findUnique({
        where: { id: message.conversation.channelId },
        select: { evolutionInstanceToken: true, evolutionInstanceId: true, name: true },
      });
      
      if (channel) {
        instanceToken = channel.evolutionInstanceToken;
        console.log('[Media] Canal encontrado:', {
          channelId: message.conversation.channelId,
          channelName: channel.name,
          instanceId: channel.evolutionInstanceId,
          hasToken: !!instanceToken,
        });
      }
    }
    
    if (!instanceToken) {
      console.error('[Media] ❌ Token da instância não encontrado');
      console.error('[Media] ChannelId:', message.conversation.channelId);
      console.error('[Media] Channel data:', {
        id: message.conversation.channel.id,
        name: message.conversation.channel.name,
        instanceId: message.conversation.channel.evolutionInstanceId,
        hasToken: !!message.conversation.channel.evolutionInstanceToken,
      });
      return res.status(500).json({ 
        error: 'Token da instância não configurado. Verifique se o canal está configurado corretamente.' 
      });
    }

    // Baixar mídia diretamente do WhatsApp usando o token
    try {
      console.log('[Media] 📥 Baixando mídia do WhatsApp...');
      console.log('[Media] URL:', mediaUrl.substring(0, 100));
      console.log('[Media] Token:', instanceToken.substring(0, 20) + '...');

      const response = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${instanceToken}`,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      console.log('[Media] ✅ Mídia baixada do WhatsApp:', {
        status: response.status,
        size: response.data.byteLength,
        contentType: response.headers['content-type'],
      });

      let buffer: Buffer;
      
      // Converter ArrayBuffer para Buffer
      if (response.data instanceof ArrayBuffer) {
        buffer = Buffer.from(response.data);
      } else {
        buffer = Buffer.from(response.data);
      }

      const encryptedBuffer = buffer;

      // Verificar se precisa descriptografar
      const needsDecryption = !!mediaMetadata?.mediaKey;
      
      if (needsDecryption && mediaMetadata.mediaKey) {
        try {
          console.log('[Media] 🔓 Tentando descriptografar mídia usando mediaKey...');
          
          // WhatsApp usa criptografia AES-256-CBC com HKDF
          const mediaKey = Buffer.from(mediaMetadata.mediaKey, 'base64');
          
          // Determinar info string baseado no tipo de mídia
          const mediaType = message.type === 'IMAGE' ? 'Image' : 
                           message.type === 'VIDEO' ? 'Video' : 
                           message.type === 'AUDIO' ? 'Audio' : 'Document';
          const info = Buffer.from(`WhatsApp ${mediaType} Keys`);
          
          // Usar HKDF para expandir a mediaKey
          // Salt vazio (32 bytes de zeros) para WhatsApp
          const salt = Buffer.alloc(32);
          
          // HKDF Extract: PRK = HMAC-SHA256(salt, IKM)
          const prk = crypto.createHmac('sha256', salt).update(mediaKey).digest();
          
          // HKDF Expand: T(0) = empty, T(N) = HMAC-SHA256(PRK, T(N-1) | info | N)
          // WhatsApp precisa de 112 bytes: IV(16) + CipherKey(32) + MacKey(32) + não usado(32)
          const okmLength = 112;
          const okm = Buffer.alloc(okmLength);
          let offset = 0;
          let counter = 1;
          let prevT = Buffer.alloc(0);
          
          while (offset < okmLength) {
            const hmac = crypto.createHmac('sha256', prk);
            if (counter > 1) {
              hmac.update(prevT);
            }
            hmac.update(info);
            hmac.update(Buffer.from([counter]));
            const t = hmac.digest();
            
            const copyLength = Math.min(t.length, okmLength - offset);
            t.copy(okm, offset, 0, copyLength);
            prevT = t;
            offset += copyLength;
            counter++;
          }
          
          // Extrair IV, cipherKey e macKey do OKM
          const iv = okm.slice(0, 16);
          const cipherKey = okm.slice(16, 48);
          const macKey = okm.slice(48, 80);
          
          console.log('[Media] 🔍 Chaves derivadas:', {
            ivLength: iv.length,
            cipherKeyLength: cipherKey.length,
            macKeyLength: macKey.length,
          });
          
          // WhatsApp: os dados criptografados têm os últimos 10 bytes como MAC
          const encryptedData = encryptedBuffer.slice(0, -10);
          const mac = encryptedBuffer.slice(-10);
          
          // Verificar integridade usando MAC
          const computedMac = crypto.createHmac('sha256', macKey)
            .update(Buffer.concat([iv, encryptedData]))
            .digest()
            .slice(0, 10);
          
          if (!crypto.timingSafeEqual(mac, computedMac)) {
            console.warn('[Media] ⚠️ MAC não corresponde! Prosseguindo mesmo assim...');
          }
          
          // Descriptografar usando AES-256-CBC
          const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
          decipher.setAutoPadding(true);
          
          let decrypted = decipher.update(encryptedData);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          
          buffer = decrypted;
          
          // Verificar magic numbers por tipo de mídia
          const isJPEG = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
          const isPNG = buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
          const isMP4 = buffer.length >= 8 && (
            (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) || // ftyp
            (buffer[4] === 0x4D && buffer[5] === 0x54 && buffer[6] === 0x79 && buffer[7] === 0x70)    // Mtyp
          );
          const isOGG = buffer.length >= 4 && buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
          const isWEBM = buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
          
          console.log('[Media] ✅ Mídia descriptografada com sucesso!', {
            mediaType: message.type,
            originalSize: encryptedBuffer.length,
            decryptedSize: buffer.length,
            firstBytes: buffer.slice(0, 8).toString('hex'),
            isJPEG,
            isPNG,
            isMP4,
            isOGG,
            isWEBM,
          });
        } catch (decryptError: any) {
          console.error('[Media] ❌ Erro ao descriptografar mídia:', decryptError.message);
          console.error('[Media] Stack:', decryptError.stack?.substring(0, 500));
          console.error('[Media] ⚠️ Enviando dados criptografados mesmo assim...');
          buffer = encryptedBuffer;
        }
      } else {
        // Dados já estão descriptografados ou não há mediaKey
        buffer = encryptedBuffer;
        if (needsDecryption) {
          console.warn('[Media] ⚠️ Dados parecem criptografados mas não há mediaKey disponível!');
        }
      }
      
      // Determinar Content-Type baseado no mimetype do metadata ou tipo da mensagem
      let contentType: string;
      if (mediaMetadata?.mimetype) {
        contentType = mediaMetadata.mimetype;
      } else if (response.headers['content-type'] || response.headers['Content-Type']) {
        contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
      } else {
        // Fallback baseado no tipo de mensagem
        switch (message.type) {
          case 'IMAGE':
            // Tentar determinar pelo magic number do buffer descriptografado
            if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
              contentType = 'image/jpeg';
            } else if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              contentType = 'image/png';
            } else {
              contentType = 'image/jpeg'; // Padrão
            }
            break;
          case 'VIDEO':
            // Tentar determinar pelo magic number do buffer descriptografado
            if (buffer.length >= 8 && (
              (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) ||
              (buffer[4] === 0x4D && buffer[5] === 0x54 && buffer[6] === 0x79 && buffer[7] === 0x70)
            )) {
              contentType = 'video/mp4';
            } else if (buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
              contentType = 'video/webm';
            } else {
              contentType = 'video/mp4'; // Padrão
            }
            break;
          case 'AUDIO':
            // Tentar determinar pelo magic number do buffer descriptografado
            if (buffer.length >= 4 && buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
              contentType = 'audio/ogg';
            } else if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
              contentType = 'audio/mp4';
            } else {
              contentType = 'audio/ogg'; // Padrão
            }
            break;
          default:
            contentType = 'application/octet-stream';
        }
      }
      
      // Validar que o buffer tem conteúdo
      if (!buffer || buffer.length === 0) {
        console.error('[Media] ❌ Buffer vazio ou inválido!');
        return res.status(500).json({ error: 'Buffer de mídia vazio ou inválido' });
      }
      
      // Verificar magic numbers por tipo de mídia
      const isJPEG = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
      const isPNG = buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isMP4 = buffer.length >= 8 && (
        (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) || // ftyp
        (buffer[4] === 0x4D && buffer[5] === 0x54 && buffer[6] === 0x79 && buffer[7] === 0x70)    // Mtyp
      );
      const isOGG = buffer.length >= 4 && buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
      const isWEBM = buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
      
      const isValidMedia = isJPEG || isPNG || isMP4 || isOGG || isWEBM || 
                          contentType.startsWith('image/') || 
                          contentType.startsWith('video/') || 
                          contentType.startsWith('audio/');
      
      console.log('[Media] ✅ Mídia baixada com sucesso do WhatsApp:', {
        mediaType: message.type,
        size: buffer.length,
        contentType,
        status: response.status,
        urlLength: mediaUrl.length,
        isJPEG,
        isPNG,
        isMP4,
        isOGG,
        isWEBM,
        isValidMedia,
        firstBytes: buffer.slice(0, 8).toString('hex'),
      });

      // Enviar resposta
      res.status(200);
      res.contentType(contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.write(buffer);
      res.end();
    } catch (error: any) {
      console.error('[Media] ❌ Erro ao baixar mídia:', error.message);
      if (error.response) {
        console.error('[Media] Status:', error.response.status);
        console.error('[Media] Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('[Media] Data:', error.response.data?.toString().substring(0, 200));
      }
      return res.status(500).json({ 
        error: 'Erro ao baixar mídia',
        details: error.message 
      });
    }
  } catch (error: any) {
    console.error('[Media] ❌ Erro geral:', error.message);
    return res.status(500).json({ 
      error: 'Erro ao processar requisição de mídia',
      details: error.message 
    });
  }
});

export default router;

