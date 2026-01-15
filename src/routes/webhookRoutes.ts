import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { WebhookService } from '../services/webhookService';
import { BotService } from '../services/botService';

const webhookService = new WebhookService();
const botService = new BotService();

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
    console.log('📨 Event:', event.event || event.eventName || event.eventType);
    console.log('📨 Data keys:', Object.keys(event.data || event));
    console.log('📨 Body completo:', JSON.stringify(event, null, 2));
    console.log('📨 ============================================');

    // Evolution API pode enviar eventos de diferentes formas
    // Verificar múltiplos formatos possíveis
    const eventType = event.event || 
                     event.eventName || 
                     event.eventType ||
                     event.data?.event ||
                     event.data?.eventName ||
                     event.data?.eventType ||
                     (event.eventName ? event.eventName : null);

    // A instância pode estar no root do evento OU dentro de data
    const instanceName = event.instance || event.data?.instance || event.instanceName || event.data?.instanceName;
    
    const eventData = event.data || event;
    
    // Adicionar instanceName ao eventData se não estiver presente
    if (instanceName && !eventData.instance && !eventData.instanceName) {
      eventData.instance = instanceName;
      eventData.instanceName = instanceName;
    }

    console.log('📨 Event Type detectado:', eventType);
    console.log('📨 Instance Name:', instanceName);
    console.log('📨 Event Data keys:', Object.keys(eventData));

    // Processar diferentes tipos de eventos
    // Evolution API pode enviar: MESSAGES_UPSERT, messages.upsert, etc.
    const normalizedEventType = (eventType || '').toLowerCase();
    
    if (normalizedEventType.includes('message') && normalizedEventType.includes('upsert')) {
      console.log('📨 Processando como MESSAGES_UPSERT');
      await handleNewMessage(eventData);
    } else if (normalizedEventType.includes('connection') && normalizedEventType.includes('update')) {
      console.log('📨 Processando como CONNECTION_UPDATE');
      await handleConnectionUpdate(eventData);
    } else if (normalizedEventType.includes('qrcode')) {
      console.log('📨 Processando como QRCODE_UPDATED');
      await handleQRCodeUpdate(eventData);
    } else {
      // Tentar processar como mensagem se tiver estrutura de mensagem
      console.log('📨 Tentando detectar tipo de evento automaticamente...');
      if (eventData.messages || event.messages || eventData.message || event.message) {
        console.log('📨 Estrutura de mensagem detectada, processando como mensagem');
        await handleNewMessage(eventData);
      } else {
        console.log('⚠️ Tipo de evento não reconhecido:', eventType);
        console.log('⚠️ Estrutura do evento:', JSON.stringify(event, null, 2).substring(0, 500));
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('❌ Erro ao processar webhook:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewMessage(data: any) {
  try {
    console.log('📩 [handleNewMessage] Processando nova mensagem...');
    console.log('📩 [handleNewMessage] Data keys:', Object.keys(data));
    console.log('📩 [handleNewMessage] Data completa:', JSON.stringify(data, null, 2).substring(0, 1000));
    
    // A Evolution API pode enviar mensagens em diferentes formatos
    // Pode ser: data.messages (array), data.message (objeto único), ou data diretamente (objeto único)
    let message: any;
    
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      message = data.messages[0];
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.messages[0]');
    } else if (data.message) {
      message = data.message;
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.message');
    } else if (data.key) {
      // A mensagem está diretamente em data (formato da Evolution API)
      message = data;
      console.log('📩 [handleNewMessage] Mensagem encontrada diretamente em data');
    } else {
      console.log('⚠️ [handleNewMessage] Nenhuma mensagem encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Estrutura recebida:', JSON.stringify(data, null, 2).substring(0, 500));
      return;
    }
    
    // O key pode estar em message.key OU diretamente em data.key
    // Quando message = data.message, o key está em data.key, não em message.key
    const messageKey = message.key || data.key;
    
    console.log('📩 [handleNewMessage] Processando mensagem:', {
      hasMessageKey: !!message.key,
      hasDataKey: !!data.key,
      hasMessageKeyFinal: !!messageKey,
      fromMe: messageKey?.fromMe,
      remoteJid: messageKey?.remoteJid || message.from || data.key?.remoteJid,
      messageId: messageKey?.id || data.key?.id,
    });
    
    // Ignorar mensagens enviadas pelo próprio sistema (fromMe)
    const fromMe = messageKey?.fromMe;
    if (fromMe) {
      console.log('ℹ️ [handleNewMessage] Mensagem ignorada (enviada pelo sistema)');
      return;
    }

    // A instância pode estar em data.instance, data.instanceName, ou no root do evento
    const instanceName = data.instance || data.instanceName;
    if (!instanceName) {
      console.log('⚠️ [handleNewMessage] Instância não encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Data keys disponíveis:', Object.keys(data));
      return;
    }
    
    console.log('📩 [handleNewMessage] Instância encontrada:', instanceName);

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) {
      console.log('Canal não encontrado para instância:', instanceName);
      return;
    }

    // Extrair número do telefone
    // O remoteJid pode estar em message.key.remoteJid, message.from, ou data.key.remoteJid
    // Quando message = data.message, o key está em data.key, não em message.key
    const remoteJid = messageKey?.remoteJid || 
                     message.from || 
                     data.key?.remoteJid ||
                     message.remoteJid;
    
    if (!remoteJid) {
      console.log('⚠️ [handleNewMessage] RemoteJid não encontrado na mensagem');
      console.log('⚠️ [handleNewMessage] Message keys:', Object.keys(message));
      console.log('⚠️ [handleNewMessage] MessageKey:', messageKey ? Object.keys(messageKey) : 'null');
      console.log('⚠️ [handleNewMessage] Data keys:', Object.keys(data));
      return;
    }

    console.log('📩 [handleNewMessage] RemoteJid encontrado:', remoteJid);
    
    // Ignorar mensagens de grupos (@g.us)
    if (remoteJid.includes('@g.us')) {
      console.log('ℹ️ [handleNewMessage] Mensagem de grupo ignorada:', remoteJid);
      return;
    }
    
    // Extrair número do telefone (remover @s.whatsapp.net, @c.us)
    const phone = remoteJid.replace('@s.whatsapp.net', '')
                           .replace('@c.us', '');
    
    // Buscar ou criar contato
    let contact = await prisma.contact.findFirst({
      where: {
        channelId: channel.id,
        channelIdentifier: phone,
      },
    });

    if (!contact) {
      // O pushName pode estar em message.pushName ou data.pushName
      const contactName = data.pushName || message.pushName || message.notifyName || phone;
      console.log('📩 [handleNewMessage] Criando novo contato:', { name: contactName, phone });
      contact = await prisma.contact.create({
        data: {
          channelId: channel.id,
          channelIdentifier: phone,
          name: contactName,
          phone: phone,
          metadata: {},
        },
      });
      console.log('✅ [handleNewMessage] Contato criado:', contact.id);
    } else {
      // Atualizar nome se mudou
      const newName = data.pushName || message.pushName || message.notifyName;
      if (newName && newName !== contact.name) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { name: newName },
        });
        contact.name = newName;
        console.log('📩 [handleNewMessage] Nome do contato atualizado:', newName);
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
    // A estrutura pode estar em message.message ou diretamente em message
    let messageContent = '';
    let messageType = 'TEXT';
    let mediaUrl: string | null = null;
    let mediaMetadata: any = null;

    // Detectar tipo e conteúdo - verificar múltiplos formatos
    const msgObj = message.message || message;
    
    if (msgObj.conversation) {
      messageContent = msgObj.conversation;
      messageType = 'TEXT';
    } else if (msgObj.extendedTextMessage?.text) {
      messageContent = msgObj.extendedTextMessage.text;
      messageType = 'TEXT';
    } else if (message.body) {
      messageContent = message.body;
      messageType = 'TEXT';
    } else if (msgObj.imageMessage) {
      messageType = 'IMAGE';
      messageContent = msgObj.imageMessage.caption || ''; // Apenas caption, sem [Imagem]
      mediaUrl = msgObj.imageMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.imageMessage.mediaKey,
        mimetype: msgObj.imageMessage.mimetype,
        fileLength: msgObj.imageMessage.fileLength,
        height: msgObj.imageMessage.height,
        width: msgObj.imageMessage.width,
      };
    } else if (msgObj.videoMessage) {
      messageType = 'VIDEO';
      messageContent = msgObj.videoMessage.caption || ''; // Apenas caption, sem [Vídeo]
      mediaUrl = msgObj.videoMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.videoMessage.mediaKey,
        mimetype: msgObj.videoMessage.mimetype,
        fileLength: msgObj.videoMessage.fileLength,
        seconds: msgObj.videoMessage.seconds,
        height: msgObj.videoMessage.height,
        width: msgObj.videoMessage.width,
      };
    } else if (msgObj.audioMessage) {
      messageType = 'AUDIO';
      messageContent = ''; // Sem texto para áudio
      mediaUrl = msgObj.audioMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.audioMessage.mediaKey,
        mimetype: msgObj.audioMessage.mimetype,
        fileLength: msgObj.audioMessage.fileLength,
        seconds: msgObj.audioMessage.seconds,
        ptt: msgObj.audioMessage.ptt,
      };
    } else if (msgObj.documentMessage) {
      messageType = 'DOCUMENT';
      messageContent = msgObj.documentMessage.fileName || ''; // Apenas nome do arquivo
      mediaUrl = msgObj.documentMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.documentMessage.mediaKey,
        mimetype: msgObj.documentMessage.mimetype,
        fileLength: msgObj.documentMessage.fileLength,
        fileName: msgObj.documentMessage.fileName,
      };
    } else {
      messageContent = '[Mensagem não suportada]';
      messageType = 'TEXT';
    }

    // Verificar se mensagem já existe (evitar duplicatas)
    const messageId = messageKey?.id || data.key?.id;
    const existingMessage = await prisma.message.findFirst({
      where: {
        externalId: messageId,
        conversationId: conversation.id,
      },
    });
    
    if (existingMessage) {
      console.log('ℹ️ [handleNewMessage] Mensagem já existe, ignorando duplicata:', messageId);
      return;
    }

    if (!existingMessage) {
      // Preparar metadata completo
      const fullMetadata: any = {
        ...data,
        ...message,
        mediaUrl: mediaUrl,
        mediaMetadata: mediaMetadata,
      };

      const createdMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: messageContent,
          type: messageType as any,
          status: 'DELIVERED',
          externalId: messageId,
          metadata: fullMetadata,
        },
      });
      
      console.log('✅ [handleNewMessage] Mensagem criada com sucesso:', {
        messageId: createdMessage.id,
        conversationId: conversation.id,
        content: messageContent.substring(0, 50),
        type: messageType,
      });

      // Verificar se há bot ativo e processar mensagem
      if (!fromMe && messageContent) {
        try {
          const botResult = await botService.processMessage(messageContent, conversation.id);
          if (botResult) {
            console.log('🤖 [handleNewMessage] Bot processou mensagem:', botResult);
            // Se o bot respondeu, não precisa emitir para n8n (ou pode emitir também)
          }
        } catch (botError: any) {
          console.error('❌ [handleNewMessage] Erro ao processar com bot:', botError.message);
          // Continuar mesmo se o bot falhar
        }
      }

      // Emitir evento para n8n (webhooks configurados)
      if (!fromMe) {
        try {
          await webhookService.emitEvent('message.received', {
            messageId: createdMessage.id,
            conversationId: conversation.id,
            contactId: contact.id,
            channelId: channel.id,
            content: messageContent,
            type: messageType,
            fromMe: false,
            metadata: {
              phone: contact.phone,
              contactName: contact.name,
            },
          }, channel.id);
        } catch (webhookError: any) {
          console.error('❌ [handleNewMessage] Erro ao emitir evento para n8n:', webhookError.message);
          // Continuar mesmo se webhook falhar
        }
      }

      // Emitir evento via Socket.IO se disponível
      if (io) {
        try {
          io.emit('new_message', {
            conversationId: conversation.id,
            channelId: channel.id,
          });
          io.emit('conversation_updated', {
            conversationId: conversation.id,
            channelId: channel.id,
          });
          console.log('📢 Eventos Socket.IO emitidos: new_message e conversation_updated');
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
        externalId: messageId,
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
    const instanceName = data.instance || data.instanceName;
    const state = data.state || data.status;
    
    console.log('[Webhook] 📡 Evento de conexão recebido:', {
      instanceName,
      state,
      dataKeys: Object.keys(data),
      fullData: JSON.stringify(data).substring(0, 500),
    });

    if (!instanceName) {
      console.warn('[Webhook] ⚠️ Instância não encontrada no evento de conexão');
      return;
    }

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) {
      console.warn('[Webhook] ⚠️ Canal não encontrado para instância:', instanceName);
      return;
    }

    // Normalizar estado - Evolution API pode enviar em diferentes formatos
    const normalizedState = (state || '').toLowerCase();
    const isConnected = normalizedState === 'open' || 
                       normalizedState === 'connected' || 
                       normalizedState === 'ready' ||
                       normalizedState === 'authenticated';
    const isDisconnected = normalizedState === 'close' || 
                          normalizedState === 'closed' || 
                          normalizedState === 'disconnected' ||
                          normalizedState === 'logout';

    console.log('[Webhook] Estado normalizado:', {
      rawState: state,
      normalizedState,
      isConnected,
      isDisconnected,
      currentChannelStatus: channel.status,
    });

    if (isConnected) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'ACTIVE' },
      });
      console.log('[Webhook] ✅ Canal conectado:', channel.name);
      
      // Configurar webhook quando o canal é conectado
      if (channel.evolutionInstanceId && channel.evolutionApiKey) {
        const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
        if (webhookBaseUrl) {
          const webhookUrl = `${webhookBaseUrl}/webhooks/evolution`;
          console.log('[Webhook] 📡 Configurando webhook após conexão:', webhookUrl);
          try {
            const { evolutionApi } = await import('../config/evolutionApi');
            await evolutionApi.setWebhook(channel.evolutionInstanceId, webhookUrl, channel.evolutionApiKey);
            console.log('[Webhook] ✅ Webhook configurado com sucesso após conexão');
          } catch (webhookError: any) {
            console.error('[Webhook] ⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
          }
        } else {
          console.warn('[Webhook] ⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
        }
      }
      
      // Emitir evento via Socket.IO
      if (io) {
        io.emit('channel_status_update', {
          channelId: channel.id,
          status: 'ACTIVE',
        });
        console.log('[Webhook] 📢 Evento Socket.IO emitido: channel_status_update');
      }
    } else if (isDisconnected) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'INACTIVE' },
      });
      console.log('[Webhook] ⚠️ Canal desconectado:', channel.name);
      
      // Emitir evento via Socket.IO
      if (io) {
        io.emit('channel_status_update', {
          channelId: channel.id,
          status: 'INACTIVE',
        });
      }
    } else {
      console.log('[Webhook] ℹ️ Estado desconhecido ou não processado:', normalizedState);
    }
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro ao processar atualização de conexão:', error);
    console.error('[Webhook] Stack:', error.stack?.substring(0, 500));
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
