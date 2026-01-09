import { Router, Request, Response } from 'express';
import prisma from '../config/database';

// io será injetado via função
let io: any = null;

export function setSocketIO(socketIO: any) {
  io = socketIO;
}

const router = Router();

// Webhook da Evolution API - Rota principal
router.post('/evolution', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('📨 ============================================');
    console.log('📨 Webhook recebido da Evolution API');
    console.log('📨 Timestamp:', new Date().toISOString());
    console.log('📨 Event:', event.event || event.eventName);
    console.log('📨 Data keys:', Object.keys(event.data || event));
    console.log('📨 Body (primeiros 1000 chars):', JSON.stringify(event, null, 2).substring(0, 1000));
    console.log('📨 ============================================');

    // Evolution API pode enviar eventos de diferentes formas
    const eventType = event.event || event.eventName || event.data?.event;
    const eventData = event.data || event;

    // Processar diferentes tipos de eventos
    if (eventType === 'messages.upsert' || event.event === 'messages.upsert') {
      await handleNewMessage(eventData);
    } else if (eventType === 'connection.update' || event.event === 'connection.update') {
      await handleConnectionUpdate(eventData);
    } else if (eventType === 'qrcode.updated' || event.event === 'qrcode.updated') {
      await handleQRCodeUpdate(eventData);
    } else {
      // Tentar processar como mensagem se tiver estrutura de mensagem
      if (eventData.messages || event.messages) {
        await handleNewMessage(eventData);
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewMessage(data: any) {
  try {
    // A Evolution API pode enviar mensagens em diferentes formatos
    const messages = data.messages || (data.message ? [data.message] : []);
    if (messages.length === 0) {
      console.log('Nenhuma mensagem encontrada no webhook');
      return;
    }

    const message = messages[0];
    
    // Ignorar mensagens enviadas pelo próprio sistema (fromMe)
    if (message.key?.fromMe) {
      console.log('Mensagem ignorada (enviada pelo sistema)');
      return;
    }

    const instanceName = data.instance || data.instanceName;
    if (!instanceName) {
      console.log('Instância não encontrada no webhook');
      return;
    }

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) {
      console.log('Canal não encontrado para instância:', instanceName);
      return;
    }

    // Extrair número do telefone
    const remoteJid = message.key?.remoteJid || message.from;
    if (!remoteJid) {
      console.log('RemoteJid não encontrado na mensagem');
      return;
    }

    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    
    // Buscar ou criar contato
    let contact = await prisma.contact.findFirst({
      where: {
        channelId: channel.id,
        channelIdentifier: phone,
      },
    });

    if (!contact) {
      const contactName = message.pushName || message.notifyName || phone;
      contact = await prisma.contact.create({
        data: {
          channelId: channel.id,
          channelIdentifier: phone,
          name: contactName,
          phone: phone,
          metadata: {},
        },
      });
    } else {
      // Atualizar nome se mudou
      const newName = message.pushName || message.notifyName;
      if (newName && newName !== contact.name) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { name: newName },
        });
        contact.name = newName;
      }
    }

    // Buscar ou criar conversa
    let conversation = await prisma.conversation.findFirst({
      where: {
        channelId: channel.id,
        contactId: contact.id,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          channelId: channel.id,
          contactId: contact.id,
          status: 'OPEN',
          unreadCount: 1,
          lastMessageAt: new Date(),
        },
      });
    } else {
      // Incrementar contador de não lidas
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });
    }

    // Extrair conteúdo e tipo da mensagem
    let messageContent = '';
    let messageType = 'TEXT';
    let mediaUrl: string | null = null;
    let mediaMetadata: any = null;

    // Detectar tipo e conteúdo
    if (message.message?.conversation) {
      messageContent = message.message.conversation;
      messageType = 'TEXT';
    } else if (message.message?.extendedTextMessage?.text) {
      messageContent = message.message.extendedTextMessage.text;
      messageType = 'TEXT';
    } else if (message.body) {
      messageContent = message.body;
      messageType = 'TEXT';
    } else if (message.message?.imageMessage) {
      messageType = 'IMAGE';
      messageContent = message.message.imageMessage.caption || '[Imagem]';
      mediaUrl = message.message.imageMessage.url;
      mediaMetadata = {
        mediaKey: message.message.imageMessage.mediaKey,
        mimetype: message.message.imageMessage.mimetype,
        fileLength: message.message.imageMessage.fileLength,
        height: message.message.imageMessage.height,
        width: message.message.imageMessage.width,
      };
    } else if (message.message?.videoMessage) {
      messageType = 'VIDEO';
      messageContent = message.message.videoMessage.caption || '[Vídeo]';
      mediaUrl = message.message.videoMessage.url;
      mediaMetadata = {
        mediaKey: message.message.videoMessage.mediaKey,
        mimetype: message.message.videoMessage.mimetype,
        fileLength: message.message.videoMessage.fileLength,
        seconds: message.message.videoMessage.seconds,
        height: message.message.videoMessage.height,
        width: message.message.videoMessage.width,
      };
    } else if (message.message?.audioMessage) {
      messageType = 'AUDIO';
      messageContent = '[Áudio]';
      mediaUrl = message.message.audioMessage.url;
      mediaMetadata = {
        mediaKey: message.message.audioMessage.mediaKey,
        mimetype: message.message.audioMessage.mimetype,
        fileLength: message.message.audioMessage.fileLength,
        seconds: message.message.audioMessage.seconds,
        ptt: message.message.audioMessage.ptt,
      };
    } else if (message.message?.documentMessage) {
      messageType = 'DOCUMENT';
      messageContent = `[Documento] ${message.message.documentMessage.fileName || ''}`;
      mediaUrl = message.message.documentMessage.url;
      mediaMetadata = {
        mediaKey: message.message.documentMessage.mediaKey,
        mimetype: message.message.documentMessage.mimetype,
        fileLength: message.message.documentMessage.fileLength,
        fileName: message.message.documentMessage.fileName,
      };
    } else {
      messageContent = '[Mensagem não suportada]';
      messageType = 'TEXT';
    }

    // Verificar se mensagem já existe (evitar duplicatas)
    const existingMessage = await prisma.message.findFirst({
      where: {
        externalId: message.key?.id,
        conversationId: conversation.id,
      },
    });

    if (!existingMessage) {
      // Preparar metadata completo
      const fullMetadata: any = {
        ...message,
        mediaUrl: mediaUrl,
        mediaMetadata: mediaMetadata,
      };

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: messageContent,
          type: messageType as any,
          status: 'DELIVERED',
          externalId: message.key?.id,
          metadata: fullMetadata,
        },
      });

      // Emitir evento via Socket.IO se disponível
      if (io) {
        try {
          io.emit('new_message', {
            conversationId: conversation.id,
            channelId: channel.id,
          });
        } catch (socketError) {
          console.error('Erro ao emitir evento Socket.IO:', socketError);
        }
      } else {
        console.log('Socket.IO não disponível para emitir evento');
      }

      console.log('✅ Mensagem processada:', {
        conversationId: conversation.id,
        type: messageType,
        content: messageContent.substring(0, 50),
        hasMedia: !!mediaUrl,
        externalId: message.key?.id,
      });
    } else {
      console.log('Mensagem duplicada ignorada:', message.key?.id);
    }
  } catch (error: any) {
    console.error('Erro ao processar nova mensagem:', error);
    console.error('Stack:', error.stack);
  }
}

async function handleConnectionUpdate(data: any) {
  try {
    const instanceName = data.instance;
    const state = data.state;

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) return;

    if (state === 'open') {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'ACTIVE' },
      });
      console.log('✅ Canal conectado:', channel.name);
      
      // Configurar webhook quando o canal é conectado
      if (channel.evolutionInstanceId && channel.evolutionApiKey) {
        const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
        if (webhookBaseUrl) {
          const webhookUrl = `${webhookBaseUrl}/webhooks/evolution`;
          console.log('📡 Configurando webhook após conexão:', webhookUrl);
          try {
            const { evolutionApi } = await import('../config/evolutionApi');
            await evolutionApi.setWebhook(channel.evolutionInstanceId, webhookUrl, channel.evolutionApiKey);
            console.log('✅ Webhook configurado com sucesso após conexão');
          } catch (webhookError: any) {
            console.error('⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
          }
        } else {
          console.warn('⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
        }
      }
    } else if (state === 'close') {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'INACTIVE' },
      });
      console.log('⚠️ Canal desconectado:', channel.name);
    }

    // Emitir evento via Socket.IO
    io.emit('channel_status_update', {
      channelId: channel.id,
      status: state === 'open' ? 'ACTIVE' : 'INACTIVE',
    });
  } catch (error: any) {
    console.error('Erro ao processar atualização de conexão:', error);
  }
}

async function handleQRCodeUpdate(data: any) {
  try {
    const instanceName = data.instance;
    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) return;

    // Emitir evento via Socket.IO para atualizar QR Code
    io.emit('qrcode_update', {
      channelId: channel.id,
      qrcode: data.qrcode?.base64,
    });
  } catch (error: any) {
    console.error('Erro ao processar atualização de QR Code:', error);
  }
}

// Rota alternativa para compatibilidade com URLs antigas (/api/whatsapp/webhook)
// Reutiliza o mesmo handler do webhook /evolution
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('📨 Webhook recebido (rota alternativa /webhook)');
    console.log('📨 Event:', event.event || event.eventName);
    
    // Processar diferentes tipos de eventos (mesma lógica do /evolution)
    const eventType = event.event || event.eventName || event.data?.event;
    const eventData = event.data || event;

    if (eventType === 'messages.upsert' || event.event === 'messages.upsert') {
      await handleNewMessage(eventData);
    } else if (eventType === 'connection.update' || event.event === 'connection.update') {
      await handleConnectionUpdate(eventData);
    } else if (eventType === 'qrcode.updated' || event.event === 'qrcode.updated') {
      await handleQRCodeUpdate(eventData);
    } else {
      if (eventData.messages || event.messages) {
        await handleNewMessage(eventData);
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
