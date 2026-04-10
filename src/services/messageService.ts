import prisma from '../config/database';
import { MessageType, MessageStatus } from '@prisma/client';
import evolutionApi from '../config/evolutionApi';
import { getWhatsAppOfficialService } from '../config/whatsappOfficial';
import { WhatsAppOfficialService } from './whatsappOfficialService';
import fs from 'fs';
import path from 'path';
import { convertOggToMp3, convertWebmToOgg } from '../utils/audioConverter';

export interface SendMessageData {
  conversationId: string;
  userId: string;
  content: string;
  type?: string;
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
  mimetype?: string; // Mimetype do arquivo (ex: audio/webm, audio/ogg)
  fromBot?: boolean; // Flag opcional para identificar mensagens enviadas pelo bot
  internalOnly?: boolean; // Se true, NÃO envia para canais externos (somente CRM)
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
    let conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: {
        channel: true,
        contact: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Se for mensagem interna (notificação apenas no CRM), não enviar para canais externos
    let externalId: string | null = null;
    let status: MessageStatus = MessageStatus.SENT;

    if (!conversation.channel) {
      // Recuperação automática: se a conversa perdeu channelId, mas o contato ainda tem,
      // reassociamos para evitar falha no envio.
      if (conversation.contact?.channelId) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { channelId: conversation.contact.channelId },
        });

        conversation = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
          include: {
            channel: true,
            contact: true,
          },
        });
      }
    }

    if (!conversation?.channel) {
      throw new Error(
        'Conversa sem canal associado. Vincule um canal ao contato/conversa antes de enviar mensagens.'
      );
    }

    // Garantir que channel não é null para TypeScript
    const channel = conversation.channel;

    const isInternalOnly = data.internalOnly === true;

    console.log('🔍 [MessageService] Verificando condições para envio:', {
      channelType: channel.type,
      hasInstanceId: !!channel.evolutionInstanceId,
      instanceId: channel.evolutionInstanceId,
      hasApiKey: !!channel.evolutionApiKey,
      hasPhone: !!conversation.contact.phone,
      phone: conversation.contact.phone,
      messageType: data.type,
      hasMediaUrl: !!data.mediaUrl,
      whatsappEnv: process.env.WHATSAPP_ENV,
      internalOnly: isInternalOnly,
    });

    // Verificar se deve usar WhatsApp Official
    const channelConfig: any = channel.config || {};
    const hasChannelOfficialConfig =
      channelConfig.provider === 'whatsapp_official' &&
      !!channelConfig.phoneNumberId &&
      !!channelConfig.businessAccountId &&
      !!channelConfig.token;

    // Se não houver credenciais no canal, tentar usar configuração global do .env (compatibilidade)
    const hasGlobalEnvOfficial =
      !!process.env.WHATSAPP_ENV &&
      (process.env.WHATSAPP_ENV === 'dev' || process.env.WHATSAPP_ENV === 'prod') &&
      getWhatsAppOfficialService() !== null;

    const shouldUseWhatsAppOfficial =
      !isInternalOnly &&
      channel.type === 'WHATSAPP' &&
      !!conversation.contact.phone &&
      (hasChannelOfficialConfig || hasGlobalEnvOfficial);

    if (shouldUseWhatsAppOfficial) {
      // Usar WhatsApp Official API
      console.log('✅ [MessageService] Usando WhatsApp Official API...');
      try {
        let whatsappService: WhatsAppOfficialService | null = null;

        if (hasChannelOfficialConfig) {
          console.log('[MessageService] Usando credenciais do canal para WhatsApp Official');
          whatsappService = new WhatsAppOfficialService({
            token: channelConfig.token,
            phoneNumberId: channelConfig.phoneNumberId,
            businessAccountId: channelConfig.businessAccountId,
          });
        } else {
          console.log('[MessageService] Usando configuração global (env) para WhatsApp Official');
          whatsappService = getWhatsAppOfficialService();
        }

        if (!whatsappService) {
          throw new Error('Serviço WhatsApp Official não disponível (sem credenciais válidas)');
        }

        const contactPhone = conversation.contact.phone;
        if (!contactPhone) {
          throw new Error('Contato não possui telefone configurado');
        }

        const phone = contactPhone.replace(/\D/g, '');
        const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

        let result: any;

        if (data.mediaUrl && data.type !== 'TEXT') {
          // Enviar mídia via WhatsApp Official
          // Para seguir exatamente a documentação da Meta:
          // - IMAGEM  -> type: "image"
          // - VÍDEO   -> type: "video"
          // - ÁUDIO   -> type: "audio" (voice message quando voice: true)
          // - DOCUMENTO -> type: "document"
          const mediaType =
            data.type === 'IMAGE'
              ? 'image'
              : data.type === 'VIDEO'
              ? 'video'
              : data.type === 'AUDIO'
              ? 'audio'
              : data.type === 'DOCUMENT'
              ? 'document'
              : 'image';

          // Construir URL pública completa para a mídia (WhatsApp Official exige link HTTP/HTTPS válido)
          const baseUrl =
            process.env.API_BASE_URL ||
            process.env.NGROK_URL ||
            process.env.APP_URL ||
            '';

          const fullMediaUrl = data.mediaUrl.startsWith('http')
            ? data.mediaUrl
            : baseUrl
            ? `${baseUrl}${data.mediaUrl}`
            : data.mediaUrl;

          const isValidHttpUrl =
            fullMediaUrl.startsWith('https://') ||
            fullMediaUrl.startsWith('http://');

          console.log('[MessageService] URL de mídia para WhatsApp Official:', {
            originalUrl: data.mediaUrl,
            fullMediaUrl,
            baseUrl,
            mediaType,
            isValidHttpUrl,
          });

          if (!isValidHttpUrl) {
            console.error(
              '❌ [MessageService] URL de mídia inválida para WhatsApp Official. ' +
                'Configure API_BASE_URL ou NGROK_URL no .env com uma URL pública (https) e tente novamente.'
            );
            throw new Error(
              'URL de mídia inválida para WhatsApp Official. Verifique a configuração de API_BASE_URL/NGROK_URL.'
            );
          }

          // Para mensagens internas do tipo AUDIO, seguimos a recomendação oficial:
          // converter para OGG/Opus e enviar como type: "audio" + voice: true.
          if (data.type === 'AUDIO') {
            console.log('[MessageService] 🎵 Áudio detectado, preparando OGG/Opus para WhatsApp Official...');
            try {
              // Extrair nome do arquivo a partir da URL local gerada pelo backend.
              let audioFilename: string | undefined;

              if (data.mediaUrl && data.mediaUrl.includes('/api/media/file/')) {
                const parts = data.mediaUrl.split('/api/media/file/');
                if (parts.length > 1) {
                  audioFilename = parts[1].split('?')[0];
                }
              }

              if (!audioFilename) {
                console.warn('[MessageService] ⚠️ Não foi possível determinar o nome do arquivo OGG a partir de mediaUrl:', {
                  mediaUrl: data.mediaUrl,
                });
              }

              if (audioFilename) {
                const uploadsDir = path.join(__dirname, '../../uploads');
                const inputPath = path.join(uploadsDir, audioFilename);

                if (!fs.existsSync(inputPath)) {
                  console.warn('[MessageService] ⚠️ Arquivo de áudio local não encontrado para envio como áudio:', {
                    inputPath,
                  });
                } else {
                  // Determinar extensão e garantir saída em OGG/Opus
                  const ext = audioFilename.toLowerCase().split('.').pop() || '';
                  let oggFilename = audioFilename;

                  if (ext !== 'ogg' && ext !== 'oga') {
                    // Converter para OGG/Opus com parâmetros adequados para voz
                    oggFilename = audioFilename.replace(/\.[^/.]+$/i, '.ogg');
                    const oggPath = path.join(uploadsDir, oggFilename);

                    if (!fs.existsSync(oggPath)) {
                      console.log('[MessageService] 🔄 Convertendo áudio para OGG/Opus antes do envio...', {
                        inputPath,
                        oggPath,
                      });
                      // Usar conversor WEBM->OGG (também funciona para outros formatos suportados pelo FFmpeg)
                      try {
                        await convertWebmToOgg(inputPath, oggPath);
                      } catch (convError: any) {
                        console.error('[MessageService] ❌ Erro ao converter áudio para OGG/Opus, tentando enviar arquivo original:', convError.message);
                        // Se a conversão falhar, manter o caminho original (pode cair no fallback via URL abaixo)
                      }
                    }
                  }

                  const finalOggPath = path.join(uploadsDir, oggFilename);
                  const hasValidOgg = fs.existsSync(finalOggPath);
                  const pathToUpload = hasValidOgg ? finalOggPath : inputPath;
                  const filenameToUpload = hasValidOgg ? oggFilename : audioFilename;

                  // Subir arquivo OGG/Opus para obter media_id (type: "audio")
                  const uploadResult = await whatsappService.uploadMedia(
                    pathToUpload,
                    'audio',
                    filenameToUpload,
                  );
                  console.log('[MessageService] ✅ Upload de áudio concluído, media_id:', uploadResult.mediaId, {
                    pathToUpload,
                    filenameToUpload,
                  });
                  
                  // Usar media_id no envio como voice message:
                  // type: "audio" + audio.voice = true + arquivo OGG/Opus.
                  result = await whatsappService.sendMediaMessage({
                    to: formattedPhone,
                    mediaId: uploadResult.mediaId,
                    type: mediaType,
                    caption: data.caption || data.content,
                    // voice: true segue a documentação oficial para renderizar
                    // com o layout de mensagem de voz (laranja).
                    voice: hasValidOgg ? true : undefined,
                  });
                }
              }

              // Se por algum motivo não conseguimos subir/enviar via media_id,
              // caímos no fallback abaixo usando a URL pública (OGG).
              if (!result) {
                console.warn('[MessageService] ⚠️ Fallback: enviando áudio via URL pública (OGG) para WhatsApp Official');
                result = await whatsappService.sendMediaMessage({
                  to: formattedPhone,
                  mediaUrl: fullMediaUrl,
                  type: mediaType,
                  caption: data.caption || data.content,
                  filename: data.fileName,
                });
              }
            } catch (uploadError: any) {
              console.error('[MessageService] ❌ Erro no fluxo de upload de áudio MP3, tentando com URL direta:', {
                error: uploadError.message,
                status: uploadError.response?.status,
                data: uploadError.response?.data,
              });
              
              // Fallback: tentar com URL direta se upload falhar
              result = await whatsappService.sendMediaMessage({
                to: formattedPhone,
                mediaUrl: fullMediaUrl,
                type: mediaType,
                caption: data.caption || data.content,
                filename: data.fileName,
              });
            }
          } else {
            // Para outros tipos de mídia (imagem, vídeo, documento), usar URL direta
            result = await whatsappService.sendMediaMessage({
              to: formattedPhone,
              mediaUrl: fullMediaUrl,
              type: mediaType,
              caption: data.caption || data.content,
              filename: data.fileName,
            });
          }
        } else {
          // Enviar texto
          result = await whatsappService.sendTextMessage({
            to: formattedPhone,
            text: data.content,
          });
        }

        externalId = result.messageId;
        status = MessageStatus.SENT;

        console.log('✅ [MessageService] Mensagem enviada via WhatsApp Official:', {
          messageId: externalId,
          phone: formattedPhone,
        });
      } catch (error: any) {
        console.error('❌ [MessageService] Erro ao enviar via WhatsApp Official:', error);
        throw error;
      }
    } else if (
      channel.type === 'WHATSAPP' &&
      channel.evolutionInstanceId &&
      channel.evolutionApiKey &&
      conversation.contact.phone
    ) {
      console.log('✅ [MessageService] Condições satisfeitas, iniciando envio...');
      try {
        console.log('📤 Enviando mensagem via Evolution API...');
        console.log('Instância:', channel.evolutionInstanceId);
        console.log('API Key presente:', !!channel.evolutionApiKey);
        console.log('Instance Token presente:', !!channel.evolutionInstanceToken);
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
        const apiKey = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY;
        
        if (!apiKey) {
          throw new Error('API key não encontrada. Configure EVOLUTION_API_KEY no .env ou no canal.');
        }
        
        console.log('📤 [MessageService] Enviando via Evolution API:', {
          instanceId: channel.evolutionInstanceId,
          number: whatsappNumber,
          contentLength: data.content.length,
          type: data.type,
          hasMediaUrl: !!data.mediaUrl,
          usingApiKey: !!apiKey,
          hasInstanceToken: !!channel.evolutionInstanceToken,
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
                channel.evolutionInstanceId!,
                whatsappNumber,
                fullMediaUrl,
                data.caption || data.content,
                apiKey
              );
              break;
            case MessageType.VIDEO:
              evolutionResponse = await evolutionApi.sendVideo(
                channel.evolutionInstanceId!,
                whatsappNumber,
                fullMediaUrl,
                data.caption || data.content,
                apiKey
              );
              break;
            case MessageType.AUDIO:
              // Determinar mimetype baseado no arquivo ou usar padrão
              // IMPORTANTE: Para audioMessage, usar apenas "audio/ogg" ou "audio/mpeg" (sem codecs=opus)
              let audioMimetype = 'audio/ogg'; // Padrão recomendado para PTT
              if (data.mimetype) {
                // Se for WEBM, forçar OGG para compatibilidade com PTT no WhatsApp
                if (data.mimetype.includes('webm')) {
                  // WEBM e OGG usam o mesmo codec (Opus), então podemos "enganar" o WhatsApp
                  // mudando o mimetype para OGG mesmo sendo WEBM
                  audioMimetype = 'audio/ogg';
                  console.log('⚠️ [MessageService] Arquivo WEBM detectado, usando mimetype OGG para compatibilidade com PTT');
                } else if (data.mimetype.includes('ogg') || data.mimetype.includes('opus')) {
                  audioMimetype = 'audio/ogg';
                } else if (data.mimetype.includes('mp3') || data.mimetype.includes('mpeg')) {
                  audioMimetype = 'audio/mpeg';
                } else {
                  // Tentar normalizar outros mimetypes
                  if (data.mimetype.includes('audio/')) {
                    audioMimetype = data.mimetype.split(';')[0]; // Remover codecs se houver
                  } else {
                    audioMimetype = 'audio/ogg'; // Fallback para OGG
                  }
                }
              } else if (fullMediaUrl.includes('.webm')) {
                // Arquivo WEBM, usar mimetype OGG para PTT
                audioMimetype = 'audio/ogg';
                console.log('⚠️ [MessageService] Arquivo WEBM detectado pela URL, usando mimetype OGG para compatibilidade com PTT');
              } else if (fullMediaUrl.includes('.ogg')) {
                audioMimetype = 'audio/ogg';
              } else if (fullMediaUrl.includes('.mp3')) {
                audioMimetype = 'audio/mpeg';
              }
              
              // Converter áudio local para base64 antes de enviar para Evolution (solução solicitada)
              let audioMedia = fullMediaUrl;
              try {
                // IMPORTANTE: Sempre converter arquivos locais para base64
                // Isso garante que o WhatsApp hospede o áudio e ele nunca "some"
                // Detectar se é um arquivo local servido pelo próprio backend
                // Verificar se a URL contém /api/media/file/ (indicando arquivo local)
                const isLocalFile = fullMediaUrl.includes('/api/media/file/');

                console.log('🔍 [MessageService] Verificando se é arquivo local para conversão base64:', {
                  fullMediaUrl,
                  isLocalFile,
                  containsApiMediaFile: fullMediaUrl.includes('/api/media/file/'),
                });

                if (isLocalFile) {
                  let filename: string | null = null;

                  try {
                    // Extrair nome do arquivo da URL (funciona tanto para URLs completas quanto relativas)
                    // Exemplo: https://ngrok.com/api/media/file/audio.ogg ou /api/media/file/audio.ogg
                    if (fullMediaUrl.includes('/api/media/file/')) {
                      const parts = fullMediaUrl.split('/api/media/file/');
                      if (parts.length > 1) {
                        filename = parts[1].split('?')[0]; // Remover query params se houver
                      }
                    }
                  } catch (parseError: any) {
                    console.warn('⚠️ [MessageService] Erro ao analisar URL de mídia para base64:', parseError.message);
                  }

                  console.log('🔍 [MessageService] Nome do arquivo extraído:', { filename });

                  if (filename) {
                    const uploadDir = path.join(__dirname, '../../uploads');
                    const filePath = path.join(uploadDir, filename);

                    console.log('🎵 [MessageService] Preparando áudio local para envio em base64...', {
                      filename,
                      filePath,
                      audioMimetype,
                      uploadDir,
                      fileExists: fs.existsSync(filePath),
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
                        base64Preview: base64.substring(0, 50) + '...',
                      });
                    } else {
                      console.warn('⚠️ [MessageService] Arquivo de áudio não encontrado para conversão base64:', {
                        filePath,
                        uploadDir,
                        dirExists: fs.existsSync(uploadDir),
                      });
                      throw new Error(`Arquivo de áudio não encontrado: ${filePath}`);
                    }
                  } else {
                    console.warn('⚠️ [MessageService] Não foi possível extrair o nome do arquivo de áudio para base64 a partir da URL:', {
                      fullMediaUrl,
                    });
                    throw new Error(`Não foi possível extrair o nome do arquivo da URL: ${fullMediaUrl}`);
                  }
                } else {
                  // Se não for arquivo local, não podemos converter para base64
                  // Isso não deveria acontecer para áudios, pois sempre devem ser locais
                  console.error('❌ [MessageService] Áudio não é arquivo local! URL:', fullMediaUrl);
                  throw new Error('Áudio deve ser um arquivo local para conversão em base64. URLs externas não são suportadas.');
                }
              } catch (base64Error: any) {
                console.error('❌ [MessageService] Erro ao converter áudio local para base64:', {
                  error: base64Error.message,
                  stack: base64Error.stack?.substring(0, 500),
                });
              }

              console.log('📤 [MessageService] Enviando áudio com mimetype e mídia:', {
                mimetype: audioMimetype,
                mediaPreview: audioMedia.substring(0, 100),
                isBase64: !audioMedia.startsWith('http://') && !audioMedia.startsWith('https://'),
              });

              evolutionResponse = await evolutionApi.sendAudio(
                channel.evolutionInstanceId!,
                whatsappNumber,
                audioMedia,
                apiKey,
                audioMimetype
              );
              break;
            case MessageType.DOCUMENT:
              evolutionResponse = await evolutionApi.sendDocument(
                channel.evolutionInstanceId!,
                whatsappNumber,
                fullMediaUrl,
                data.fileName || 'document',
                data.caption || data.content,
                apiKey
              );
              break;
            default:
              evolutionResponse = await evolutionApi.sendMessage(
                channel.evolutionInstanceId!,
                whatsappNumber,
                data.content,
                apiKey
              );
          }
        } else {
          // Enviar mensagem de texto
          evolutionResponse = await evolutionApi.sendMessage(
            channel.evolutionInstanceId!,
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
    } else if (!isInternalOnly) {
      const reasons = [];
      if (channel.type !== 'WHATSAPP') reasons.push('não é WhatsApp');
      if (!channel.evolutionInstanceId) reasons.push('sem instanceId');
      if (!channel.evolutionApiKey) reasons.push('sem API key');
      if (!conversation.contact.phone) reasons.push('sem telefone do contato');
      
      console.log('ℹ️ [MessageService] Mensagem NÃO será enviada via Evolution API:', {
        reasons: reasons.length > 0 ? reasons.join(', ') : 'condição não satisfeita',
        channelType: channel.type,
        hasInstanceId: !!channel.evolutionInstanceId,
        instanceId: channel.evolutionInstanceId,
        hasApiKey: !!channel.evolutionApiKey,
        hasPhone: !!conversation.contact.phone,
        phone: conversation.contact.phone,
      });
    } else {
      console.log('ℹ️ [MessageService] Mensagem marcada como internalOnly, não será enviada para canais externos.');
    }

    // Preparar metadata para mídias e flags auxiliares
    const metadata: any = {};
    if (data.mediaUrl) {
      metadata.mediaUrl = data.mediaUrl;

      // Para arquivos servidos por /api/media/file, derivar o nome real do arquivo
      // a partir da URL (garantindo extensão e nome exatos salvos em disco).
      let derivedFileName: string | undefined;
      if (data.mediaUrl.startsWith('/api/media/file/')) {
        derivedFileName = data.mediaUrl.replace('/api/media/file/', '').split('?')[0];
      }

      if (derivedFileName) {
        metadata.fileName = derivedFileName;
      } else if (data.fileName) {
        // Fallback: usar fileName enviado pelo cliente apenas se não for possível derivar da URL
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

    if (data.fromBot) {
      metadata.fromBot = true;
    }

    // Se userId vier como string vazia (caso de mensagens de bot), converter para null
    const normalizedUserId = data.userId && data.userId.trim().length > 0 ? data.userId : null;

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        userId: normalizedUserId,
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

    if (normalizedUserId) {
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
