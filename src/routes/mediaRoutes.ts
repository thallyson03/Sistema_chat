import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import axios from 'axios';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { convertWebmToOgg } from '../utils/audioConverter';

const router = Router();

// Configurar multer para upload de arquivos
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar imagens, vídeos, áudios e documentos
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
});

// Helper para validar nomes de arquivo e evitar path traversal
function isSafeFilename(filename: string): boolean {
  return (
    !!filename &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

// Rota para upload de arquivos
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    let finalFilename = req.file.filename;
    let finalMimetype = req.file.mimetype;
    let finalSize = req.file.size;
    const originalPath = req.file.path;

    // Log detalhado do arquivo recebido
    console.log('[Media] 📥 Arquivo recebido:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: originalPath,
    });

    // Se for áudio WEBM, converter para OGG para compatibilidade com WhatsApp mobile
    // Detectar WEBM por mimetype OU por extensão do arquivo
    const isWebmAudio = 
      (req.file.mimetype.includes('webm') && req.file.mimetype.includes('audio')) ||
      (req.file.originalname.toLowerCase().endsWith('.webm') && req.file.mimetype.includes('audio')) ||
      (req.file.filename.toLowerCase().endsWith('.webm') && req.file.mimetype.includes('audio')) ||
      req.file.mimetype === 'video/webm'; // Alguns navegadores reportam WEBM de áudio como video/webm
    
    console.log('[Media] 🔍 Verificação WEBM:', {
      isWebmAudio,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      filename: req.file.filename,
    });
    
    if (isWebmAudio) {
      try {
        console.log('[Media] 🎵 Arquivo WEBM detectado, convertendo para OGG para compatibilidade com WhatsApp mobile...');
        console.log('[Media] Arquivo original:', {
          filename: req.file.filename,
          path: originalPath,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
        
        const oggFilename = req.file.filename.replace(/\.webm$/i, '.ogg');
        const oggPath = path.join(uploadDir, oggFilename);
        
        console.log('[Media] Iniciando conversão...');
        await convertWebmToOgg(originalPath, oggPath);
        
        // Verificar se o arquivo OGG foi criado
        if (!fs.existsSync(oggPath)) {
          throw new Error('Arquivo OGG não foi criado após a conversão');
        }
        
        const oggStats = fs.statSync(oggPath);
        console.log('[Media] Arquivo OGG criado:', {
          path: oggPath,
          size: oggStats.size,
          exists: fs.existsSync(oggPath),
        });
        
        // Remover arquivo WEBM original
        try {
          fs.unlinkSync(originalPath);
          console.log('[Media] Arquivo WEBM original removido');
        } catch (unlinkError) {
          console.warn('[Media] ⚠️ Não foi possível remover arquivo WEBM original:', unlinkError);
        }
        
        // Usar arquivo OGG convertido
        finalFilename = oggFilename;
        finalMimetype = 'audio/ogg; codecs=opus';
        finalSize = oggStats.size;
        
        console.log('[Media] ✅ Conversão concluída com sucesso:', {
          original: req.file.filename,
          converted: finalFilename,
          originalSize: req.file.size,
          convertedSize: finalSize,
          mimetype: finalMimetype,
        });
      } catch (conversionError: any) {
        console.error('[Media] ❌ Erro ao converter WEBM para OGG:', conversionError.message);
        console.error('[Media] Stack:', conversionError.stack?.substring(0, 500));
        console.error('[Media] ⚠️ Usando arquivo WEBM original (pode não funcionar no WhatsApp mobile)');
        // Se a conversão falhar, usar o arquivo original (pode não funcionar no mobile)
      }
    }

    const fileUrl = `/api/media/file/${finalFilename}`;
    
    res.json({
      url: fileUrl,
      filename: finalFilename,
      originalName: req.file.originalname,
      mimetype: finalMimetype,
      size: finalSize,
    });
  } catch (error: any) {
    console.error('[Media] Erro no upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para servir arquivos enviados (público para Evolution API poder baixar)
router.get('/file/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;

  if (!isSafeFilename(filename)) {
    console.error('[Media] ❌ Nome de arquivo inválido (possível path traversal):', filename);
    return res.status(400).json({ error: 'Nome de arquivo inválido' });
  }

  const filePath = path.resolve(uploadDir, filename);

  // Garante que o caminho final permanece dentro de uploadDir
  if (!filePath.startsWith(path.resolve(uploadDir))) {
    console.error('[Media] ❌ Caminho de arquivo fora do diretório permitido:', filePath);
    return res.status(400).json({ error: 'Caminho de arquivo inválido' });
  }

  if (!fs.existsSync(filePath)) {
    console.error('[Media] ❌ Arquivo não encontrado:', filename);
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  // Headers para permitir acesso público e CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache de 1 ano
  
  // Determinar Content-Type baseado na extensão
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
  };
  
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
  }

  console.log('[Media] ✅ Servindo arquivo:', {
    filename,
    path: filePath,
    contentType: mimeTypes[ext] || 'application/octet-stream',
    size: fs.statSync(filePath).size,
  });

  res.sendFile(filePath);
});

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
    if (!['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.type)) {
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
    console.log('[Media] MediaUrl completo:', mediaUrl);
    console.log('[Media] MediaMetadata keys:', Object.keys(mediaMetadata));
    console.log('[Media] HasMediaKey:', !!mediaMetadata?.mediaKey);
    console.log(
      '[Media] Metadata completo (primeiros 500 chars):',
      JSON.stringify(metadata, null, 2).substring(0, 500),
    );
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

    // Verificar se é URL local (arquivo enviado pelo sistema)
    // URLs locais começam com /api/media/file/ ou são caminhos relativos
    if (mediaUrl.startsWith('/api/media/file/')) {
      console.log('[Media] 📁 Detectado arquivo local, servindo diretamente...');
      
      // Extrair nome do arquivo da URL
      const filename = mediaUrl.replace('/api/media/file/', '');

      if (!isSafeFilename(filename)) {
        console.error('[Media] ❌ Nome de arquivo inválido em mediaUrl (possível path traversal):', filename);
        return res.status(400).json({ error: 'Nome de arquivo inválido' });
      }

      const filePath = path.resolve(uploadDir, filename);

      // Garante que o caminho final permanece dentro de uploadDir
      if (!filePath.startsWith(path.resolve(uploadDir))) {
        console.error('[Media] ❌ Caminho de arquivo fora do diretório permitido em mediaUrl:', filePath);
        return res.status(400).json({ error: 'Caminho de arquivo inválido' });
      }
      
      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        console.error('[Media] ❌ Arquivo local não encontrado:', filePath);
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      // Determinar Content-Type baseado na extensão
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.ogg': 'audio/ogg',
        '.webm': 'audio/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.pdf': 'application/pdf',
      };
      
      // Para arquivos OGG, usar o mimetype correto com codecs
      let contentType = mimeTypes[ext] || mediaMetadata?.mimetype || 'application/octet-stream';
      
      // Se for OGG e o metadata tiver mimetype com codecs, usar ele
      if (ext === '.ogg' && metadata?.mimetype && metadata.mimetype.includes('codecs')) {
        contentType = metadata.mimetype;
      } else if (ext === '.ogg' && !contentType.includes('codecs')) {
        // Se não tiver codecs no mimetype, adicionar
        contentType = 'audio/ogg; codecs=opus';
      }
      
      console.log('[Media] ✅ Servindo arquivo local:', {
        filename,
        path: filePath,
        contentType,
        size: fs.statSync(filePath).size,
        ext,
        metadataMimetype: metadata?.mimetype,
      });
      
      res.status(200);
      res.contentType(contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Accept-Ranges', 'bytes');
      res.sendFile(filePath);
      return;
    }

    // Verificar se a conversa tem canal associado
    if (!message.conversation.channelId) {
      return res.status(404).json({ 
        error: 'Conversa não possui canal associado' 
      });
    }

    // Verificar provedor do canal (Evolution x WhatsApp Official)
    const channelProvider =
      (message.conversation.channel?.config as any)?.provider || 'evolution';

    // ============================================
    // Fluxo para WhatsApp Official (Meta Cloud API)
    // ============================================
    if (channelProvider === 'whatsapp_official') {
      // Token pode vir da config do canal ou das variáveis de ambiente
      const channelConfig = (message.conversation.channel?.config || {}) as any;
      const appToken =
        channelConfig.token ||
        process.env.WHATSAPP_DEV_TOKEN ||
        process.env.WHATSAPP_TOKEN;

      if (!appToken) {
        console.error(
          '[Media] ❌ Token da API oficial não configurado (WHATSAPP_DEV_TOKEN / WHATSAPP_TOKEN ou config.token).',
        );
        return res.status(500).json({
          error:
            'Token da API oficial não configurado. Configure WHATSAPP_DEV_TOKEN ou WHATSAPP_TOKEN no .env ou no canal.',
        });
      }

      try {
        console.log('[Media] 📥 Baixando mídia do WhatsApp Official (Cloud API)...');
        console.log('[Media] URL atual em metadata:', mediaUrl.substring(0, 120));

        let downloadUrl = mediaUrl;

        // Se o mediaUrl não começa com http, provavelmente é apenas o mediaId antigo salvo no banco.
        // Precisamos primeiro buscar a URL real no Graph API: GET /{media-id}
        if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
          const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
          const mediaId = downloadUrl;

          console.log('[Media] 🔍 mediaUrl não é uma URL, tratando como mediaId:', mediaId);
          console.log(
            '[Media] 🔍 Buscando metadados da mídia no Graph API:',
            `https://graph.facebook.com/${apiVersion}/${mediaId}`,
          );

          try {
            const metaResp = await axios.get(
              `https://graph.facebook.com/${apiVersion}/${mediaId}`,
              {
                headers: {
                  Authorization: `Bearer ${appToken}`,
                },
                timeout: 15000,
              },
            );

            const graphUrl = metaResp.data?.url;
            if (graphUrl && typeof graphUrl === 'string') {
              downloadUrl = graphUrl;
              console.log('[Media] ✅ URL da mídia obtida do Graph API:', downloadUrl.substring(0, 120));
            } else {
              console.warn(
                '[Media] ⚠️ Resposta do Graph API não contém campo url. Usando mediaId diretamente (pode falhar).',
                JSON.stringify(metaResp.data || {}, null, 2).substring(0, 300),
              );
            }
          } catch (graphError: any) {
            console.error(
              '[Media] ❌ Erro ao buscar URL da mídia no Graph API:',
              graphError.message,
            );
            if (graphError.response) {
              console.error(
                '[Media] Graph status:',
                graphError.response.status,
                'data:',
                JSON.stringify(graphError.response.data || {}, null, 2).substring(0, 300),
              );
            }
            // Continua tentando usar o mediaUrl original; pode funcionar em alguns casos
          }
        }

        console.log('[Media] 📥 Fazendo download da mídia a partir de:', downloadUrl.substring(0, 160));

        // Para Cloud API, a URL de mídia normalmente requer o mesmo access token usado na API.
        const response = await axios.get(downloadUrl, {
          headers: {
            Authorization: `Bearer ${appToken}`,
          },
          responseType: 'arraybuffer',
          timeout: 30000,
        });

        const buffer = Buffer.from(response.data);
        const contentType =
          response.headers['content-type'] ||
          response.headers['Content-Type'] ||
          (message.type === 'IMAGE'
            ? 'image/jpeg'
            : message.type === 'VIDEO'
            ? 'video/mp4'
            : message.type === 'AUDIO'
            ? 'audio/ogg'
            : 'application/octet-stream');

        console.log('[Media] ✅ Mídia baixada do WhatsApp Official:', {
          mediaType: message.type,
          size: buffer.length,
          contentType,
          status: response.status,
        });

        res.status(200);
        res.contentType(contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.write(buffer);
        res.end();
        return;
      } catch (error: any) {
        console.error('[Media] ❌ Erro ao baixar mídia do WhatsApp Official:', error.message);
        if (error.response) {
          console.error('[Media] Status:', error.response.status);
          console.error(
            '[Media] Data:',
            typeof error.response.data === 'string'
              ? error.response.data.substring(0, 200)
              : JSON.stringify(error.response.data, null, 2).substring(0, 200),
          );
        }
        return res.status(500).json({
          error: 'Erro ao baixar mídia do WhatsApp Official',
          details: error.message,
        });
      }
    }

    // ============================================
    // Fluxo original Evolution API (Baileys)
    // ============================================

    // Buscar token da instância para autenticação
    let instanceToken: string | null = null;
    
    if (message.conversation.channel) {
      instanceToken = message.conversation.channel.evolutionInstanceToken;
    }
    
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
      if (message.conversation.channel) {
        console.error('[Media] Channel data:', {
          id: message.conversation.channel.id,
          name: message.conversation.channel.name,
          instanceId: message.conversation.channel.evolutionInstanceId,
          hasToken: !!message.conversation.channel.evolutionInstanceToken,
        });
      }
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
            if (buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
              contentType = 'audio/webm'; // WEBM
            } else if (buffer.length >= 4 && buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
              contentType = 'audio/ogg'; // OGG
            } else if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
              contentType = 'audio/mp4'; // MP4/M4A
            } else if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
              contentType = 'audio/wav'; // WAV
            } else {
              // Usar mimetype do metadata se disponível, senão padrão
              contentType = mediaMetadata?.mimetype || 'audio/ogg';
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

