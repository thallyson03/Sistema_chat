import prisma from '../config/database';
import { MessageType, MessageStatus } from '@prisma/client';
import evolutionApi from '../config/evolutionApi';
import fs from 'fs';
import path from 'path';

export interface SendMessageData {
  conversationId: string;
  userId: string;
  content: string;
  type?: string;
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
  mimetype?: string; // Mimetype do arquivo (ex: audio/webm, audio/ogg)
}

export class MessageService {
  async sendMessage(data: SendMessageData) {
    console.log('🚀 [MessageService] sendMessage chamado:', {
      conversationId: data.conversationId,
      userId: data.userId,
      type: data.type,
      hasMediaUrl: !!data.mediaUrl,
      contentLength: data.content?.length || 0,
    });
    
    // Buscar conversa com canal e contato
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: {
        channel: true,
        contact: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Se for WhatsApp e tiver instância configurada, enviar via Evolution API
    let externalId: string | null = null;
    let status: MessageStatus = MessageStatus.SENT;

    console.log('🔍 [MessageService] Verificando condições para envio:', {
      channelType: conversation.channel.type,
      hasInstanceId: !!conversation.channel.evolutionInstanceId,
      instanceId: conversation.channel.evolutionInstanceId,
      hasApiKey: !!conversation.channel.evolutionApiKey,
      hasPhone: !!conversation.contact.phone,
      phone: conversation.contact.phone,
      messageType: data.type,
      hasMediaUrl: !!data.mediaUrl,
    });

    if (
      conversation.channel.type === 'WHATSAPP' &&
      conversation.channel.evolutionInstanceId &&
      conversation.channel.evolutionApiKey &&
      conversation.contact.phone
    ) {
      console.log('✅ [MessageService] Condições satisfeitas, iniciando envio...');
      try {
        console.log('📤 Enviando mensagem via Evolution API...');
        console.log('Instância:', conversation.channel.evolutionInstanceId);
        console.log('API Key presente:', !!conversation.channel.evolutionApiKey);
        console.log('Instance Token presente:', !!conversation.channel.evolutionInstanceToken);
        console.log('Telefone original:', conversation.contact.phone);
        
        // Formatar telefone corretamente
        let phone = conversation.contact.phone.replace(/\D/g, ''); // Remove caracteres não numéricos
        
        // Se não começar com código do país, adicionar 55 (Brasil)
        if (!phone.startsWith('55') && phone.length <= 11) {
          phone = `55${phone}`;
        }
        
        // Formato para WhatsApp: número@s.whatsapp.net
        const whatsappNumber = `${phone}@s.whatsapp.net`;
        console.log('Número formatado:', whatsappNumber);
        console.log('Conteúdo:', data.content.substring(0, 50));
        
        // Usar API key master (não o token da instância para envio de mensagens)
        // O token da instância é usado apenas para webhook, não para envio
        const apiKey = conversation.channel.evolutionApiKey || process.env.EVOLUTION_API_KEY;
        
        if (!apiKey) {
          throw new Error('API key não encontrada. Configure EVOLUTION_API_KEY no .env ou no canal.');
        }
        
        console.log('📤 [MessageService] Enviando via Evolution API:', {
          instanceId: conversation.channel.evolutionInstanceId,
          number: whatsappNumber,
          contentLength: data.content.length,
          type: data.type,
          hasMediaUrl: !!data.mediaUrl,
          usingApiKey: !!apiKey,
          hasInstanceToken: !!conversation.channel.evolutionInstanceToken,
        });
        
        let evolutionResponse: any;
        const messageType = (data.type as MessageType) || MessageType.TEXT;

        // Enviar mídia se houver URL
        if (data.mediaUrl && messageType !== MessageType.TEXT) {
          // Usar API_BASE_URL (ngrok) para URLs públicas acessíveis pela Evolution API
          const baseUrl = process.env.API_BASE_URL || process.env.NGROK_URL || process.env.APP_URL || 'http://localhost:3007';
          const fullMediaUrl = data.mediaUrl.startsWith('http') 
            ? data.mediaUrl 
            : `${baseUrl}${data.mediaUrl}`;

          const isPublicUrl = fullMediaUrl.startsWith('https://') || fullMediaUrl.startsWith('http://');
          const isNgrok = fullMediaUrl.includes('ngrok');
          
          console.log('📤 [MessageService] URL de mídia construída:', {
            originalUrl: data.mediaUrl,
            fullMediaUrl,
            baseUrl,
            messageType,
            isPublic: isPublicUrl,
            isNgrok,
            warning: !isNgrok && baseUrl.includes('localhost') ? '⚠️ URL não é pública! A Evolution API não conseguirá baixar o arquivo. Configure API_BASE_URL ou NGROK_URL no .env' : null,
          });
          
          if (!isNgrok && baseUrl.includes('localhost')) {
            console.error('❌ [MessageService] ERRO CRÍTICO: URL não é pública!');
            console.error('❌ A Evolution API precisa de uma URL pública (ngrok) para baixar o arquivo.');
            console.error('❌ Configure API_BASE_URL ou NGROK_URL no .env com a URL do ngrok.');
          }

          switch (messageType) {
            case MessageType.IMAGE:
              evolutionResponse = await evolutionApi.sendImage(
                conversation.channel.evolutionInstanceId,
                whatsappNumber,
                fullMediaUrl,
                data.caption || data.content,
                apiKey
              );
              break;
            case MessageType.VIDEO:
              evolutionResponse = await evolutionApi.sendVideo(
                conversation.channel.evolutionInstanceId,
                whatsappNumber,
                fullMediaUrl,
                data.caption || data.content,
                apiKey
              );
              break;
            case MessageType.AUDIO:
              // Determinar mimetype baseado no arquivo ou usar padrão
              // IMPORTANTE: WhatsApp não aceita WEBM como PTT, então sempre usar OGG para PTT
              let audioMimetype = 'audio/ogg; codecs=opus'; // Padrão recomendado para PTT
              if (data.mimetype) {
                // Se for WEBM, forçar OGG para compatibilidade com PTT no WhatsApp
                if (data.mimetype.includes('webm')) {
                  // WEBM e OGG usam o mesmo codec (Opus), então podemos "enganar" o WhatsApp
                  // mudando o mimetype para OGG mesmo sendo WEBM
                  audioMimetype = 'audio/ogg; codecs=opus';
                  console.log('⚠️ [MessageService] Arquivo WEBM detectado, usando mimetype OGG para compatibilidade com PTT');
                } else if (data.mimetype.includes('ogg')) {
                  audioMimetype = 'audio/ogg; codecs=opus';
                } else if (data.mimetype.includes('mp3') || data.mimetype.includes('mpeg')) {
                  audioMimetype = 'audio/mpeg';
                } else {
                  audioMimetype = data.mimetype;
                }
              } else if (fullMediaUrl.includes('.webm')) {
                // Arquivo WEBM, usar mimetype OGG para PTT
                audioMimetype = 'audio/ogg; codecs=opus';
                console.log('⚠️ [MessageService] Arquivo WEBM detectado pela URL, usando mimetype OGG para compatibilidade com PTT');
              } else if (fullMediaUrl.includes('.ogg')) {
                audioMimetype = 'audio/ogg; codecs=opus';
              }
              
              // Converter áudio local para base64 antes de enviar para Evolution (solução solicitada)
              let audioMedia = fullMediaUrl;
              try {
                // Detectar se é um arquivo local servido pelo próprio backend
                const isLocalFile =
                  fullMediaUrl.startsWith('/api/media/file/') ||
                  fullMediaUrl.includes('/api/media/file/') ||
                  fullMediaUrl.includes('localhost');

                if (isLocalFile) {
                  let filename: string | null = null;

                  try {
                    // Caso URL completa (http://.../api/media/file/xxx.ogg)
                    if (fullMediaUrl.startsWith('http://') || fullMediaUrl.startsWith('https://')) {
                      const url = new URL(fullMediaUrl);
                      const parts = url.pathname.split('/api/media/file/');
                      if (parts.length > 1) {
                        filename = parts[1];
                      }
                    } else if (fullMediaUrl.includes('/api/media/file/')) {
                      // Caminho relativo /api/media/file/xxx.ogg
                      filename = fullMediaUrl.split('/api/media/file/')[1];
                    }
                  } catch (parseError: any) {
                    console.warn('⚠️ [MessageService] Erro ao analisar URL de mídia para base64:', parseError.message);
                  }

                  if (filename) {
                    const uploadDir = path.join(__dirname, '../../uploads');
                    const filePath = path.join(uploadDir, filename);

                    console.log('🎵 [MessageService] Preparando áudio local para envio em base64...', {
                      filename,
                      filePath,
                      audioMimetype,
                    });

                    if (fs.existsSync(filePath)) {
                      const fileBuffer = fs.readFileSync(filePath);
                      const base64 = fileBuffer.toString('base64');
                      // IMPORTANTE: Evolution espera APENAS o base64, sem o prefixo data:
                      audioMedia = base64;

                      console.log('✅ [MessageService] Áudio convertido para base64 com sucesso:', {
                        originalUrl: fullMediaUrl,
                        base64Length: base64.length,
                        fileSize: fileBuffer.length,
                      });
                    } else {
                      console.warn('⚠️ [MessageService] Arquivo de áudio não encontrado para conversão base64:', {
                        filePath,
                      });
                    }
                  } else {
                    console.warn('⚠️ [MessageService] Não foi possível extrair o nome do arquivo de áudio para base64 a partir da URL:', {
                      fullMediaUrl,
                    });
                  }
                }
              } catch (base64Error: any) {
                console.error('❌ [MessageService] Erro ao converter áudio local para base64:', base64Error.message);
              }

              console.log('📤 [MessageService] Enviando áudio com mimetype e mídia:', {
                mimetype: audioMimetype,
                mediaPreview: audioMedia.substring(0, 100),
                isBase64: !audioMedia.startsWith('http://') && !audioMedia.startsWith('https://'),
              });

              evolutionResponse = await evolutionApi.sendAudio(
                conversation.channel.evolutionInstanceId,
                whatsappNumber,
                audioMedia,
                apiKey,
                audioMimetype
              );
              break;
            case MessageType.DOCUMENT:
              evolutionResponse = await evolutionApi.sendDocument(
                conversation.channel.evolutionInstanceId,
                whatsappNumber,
                fullMediaUrl,
                data.fileName || 'document',
                data.caption || data.content,
                apiKey
              );
              break;
            default:
              evolutionResponse = await evolutionApi.sendMessage(
                conversation.channel.evolutionInstanceId,
                whatsappNumber,
                data.content,
                apiKey
              );
          }
        } else {
          // Enviar mensagem de texto
          evolutionResponse = await evolutionApi.sendMessage(
            conversation.channel.evolutionInstanceId,
            whatsappNumber,
            data.content,
            apiKey
          );
        }

        console.log('✅ [MessageService] Mensagem enviada com sucesso:', {
          response: JSON.stringify(evolutionResponse, null, 2).substring(0, 500),
          hasKey: !!evolutionResponse.key,
          hasId: !!evolutionResponse.id,
        });
        
        externalId = evolutionResponse.key?.id || evolutionResponse.id || null;
        status = MessageStatus.SENT;
        
        console.log('✅ [MessageService] Status da mensagem:', {
          status,
          externalId,
        });
      } catch (error: any) {
        console.error('❌ Erro ao enviar mensagem via Evolution API:', error.message);
        console.error('Stack:', error.stack?.substring(0, 500));
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        // Continua salvando a mensagem mesmo se falhar o envio
        status = MessageStatus.FAILED;
        // Não re-throw aqui - vamos salvar a mensagem mesmo com falha no envio
        console.warn('⚠️ Mensagem será salva mesmo com falha no envio via Evolution API');
      }
    } else {
      const reasons = [];
      if (conversation.channel.type !== 'WHATSAPP') reasons.push('não é WhatsApp');
      if (!conversation.channel.evolutionInstanceId) reasons.push('sem instanceId');
      if (!conversation.channel.evolutionApiKey) reasons.push('sem API key');
      if (!conversation.contact.phone) reasons.push('sem telefone do contato');
      
      console.log('ℹ️ [MessageService] Mensagem NÃO será enviada via Evolution API:', {
        reasons: reasons.length > 0 ? reasons.join(', ') : 'condição não satisfeita',
        channelType: conversation.channel.type,
        hasInstanceId: !!conversation.channel.evolutionInstanceId,
        instanceId: conversation.channel.evolutionInstanceId,
        hasApiKey: !!conversation.channel.evolutionApiKey,
        hasPhone: !!conversation.contact.phone,
        phone: conversation.contact.phone,
      });
    }

    // Preparar metadata para mídias
    const metadata: any = {};
    if (data.mediaUrl) {
      metadata.mediaUrl = data.mediaUrl;
      if (data.fileName) {
        metadata.fileName = data.fileName;
      }
      if (data.caption) {
        metadata.caption = data.caption;
      }
      // Salvar mimetype para áudio (importante para reprodução)
      if (data.type === MessageType.AUDIO && data.mimetype) {
        metadata.mimetype = data.mimetype;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        userId: data.userId,
        content: data.content,
        type: (data.type as MessageType) || MessageType.TEXT,
        status: status,
        externalId: externalId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Atualizar última mensagem da conversa
    // Se a mensagem foi enviada por um usuário (agente), atualizar lastAgentMessageAt
    const updateData: any = {
      lastMessageAt: new Date(),
    };

    if (data.userId) {
      updateData.lastAgentMessageAt = new Date();
    }

    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: updateData,
    });

    console.log('✅ [MessageService] Mensagem salva e conversa atualizada:', {
      messageId: message.id,
      conversationId: data.conversationId,
      status: message.status,
    });

    return message;
  }

  async getMessagesByConversation(conversationId: string, limit: number, offset: number) {
    return await prisma.message.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  async markConversationAsRead(conversationId: string, userId: string) {
    // Atualizar contador de não lidas
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
      },
    });
  }
}
