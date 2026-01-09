import prisma from '../config/database';
import { Channel, ChannelType, ChannelStatus } from '@prisma/client';
import evolutionApi from '../config/evolutionApi';

export interface CreateChannelData {
  name: string;
  type: ChannelType;
  config?: any;
  evolutionApiKey?: string;
  evolutionInstanceId?: string;
  evolutionInstanceToken?: string;
}

export class ChannelService {
  /**
   * Obtém a URL do webhook (prioriza NGROK_URL para ambiente de teste)
   */
  private getWebhookUrl(): string | null {
    const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
    if (webhookBaseUrl) {
      return `${webhookBaseUrl}/webhooks/evolution`;
    }
    return null;
  }

  /**
   * Configura o webhook na Evolution API para uma instância
   */
  private async configureWebhook(instanceId: string, apiKey: string): Promise<void> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      console.warn('[ChannelService] ⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
      return;
    }

    try {
      console.log('[ChannelService] Configurando webhook:', {
        instanceId,
        webhookUrl,
        usingNgrok: !!process.env.NGROK_URL,
      });
      await evolutionApi.setWebhook(instanceId, webhookUrl, apiKey);
      console.log('[ChannelService] ✅ Webhook configurado com sucesso');
    } catch (error: any) {
      console.error('[ChannelService] ❌ Erro ao configurar webhook:', error.message);
      if (error.response) {
        console.error('[ChannelService] Status:', error.response.status);
        console.error('[ChannelService] Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async getChannels(): Promise<Channel[]> {
    return await prisma.channel.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getChannelById(id: string): Promise<Channel | null> {
    return await prisma.channel.findUnique({
      where: { id },
    });
  }

  async createChannel(data: CreateChannelData): Promise<Channel> {
    let instanceId = data.evolutionInstanceId;
    let instanceToken = data.evolutionInstanceToken;

    // Se for WhatsApp e tiver API key (do .env ou fornecida), criar instância na Evolution API
    const apiKey = data.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    if (data.type === ChannelType.WHATSAPP && apiKey && !instanceId) {
      try {
        const instanceName = `channel_${Date.now()}`;
        console.log('[ChannelService] Criando instância na Evolution API:', {
          instanceName,
          hasApiKey: !!apiKey,
        });
        
        const evolutionResponse = await evolutionApi.createInstance(
          instanceName,
          apiKey,
          true // qrcode: true para gerar QR code automaticamente
        );
        
        console.log('[ChannelService] Resposta completa da criação de instância:', JSON.stringify(evolutionResponse, null, 2).substring(0, 1000));
        console.log('[ChannelService] Resposta da criação de instância:', {
          hasInstance: !!evolutionResponse.instance,
          instanceName: evolutionResponse.instance?.instanceName,
          hasToken: !!evolutionResponse.instance?.token,
          hasQrcode: !!evolutionResponse.qrcode,
          hasQrcodeBase64: !!evolutionResponse.qrcode?.base64,
          keys: Object.keys(evolutionResponse),
        });
        
        instanceId = evolutionResponse.instance?.instanceName || instanceName;
        instanceToken = evolutionResponse.instance?.token;
        
        // Verificar se o QR code já veio na resposta da criação
        if (evolutionResponse.qrcode?.base64) {
          console.log('[ChannelService] ✅ QR Code recebido na criação da instância!');
        }
        
        console.log('[ChannelService] Instância criada:', {
          instanceId,
          hasToken: !!instanceToken,
        });

        // Configurar webhook na criação (tentativa inicial)
        if (instanceId) {
          try {
            await this.configureWebhook(instanceId, apiKey);
          } catch (webhookError: any) {
            console.error('[ChannelService] ⚠️ Erro ao configurar webhook na criação:', webhookError.message);
            // Não bloqueia a criação do canal se o webhook falhar
          }
        }
      } catch (error: any) {
        console.error('Erro ao criar instância na Evolution API:', error.message);
        // Continua criando o canal mesmo se falhar a criação da instância
      }
    }

    return await prisma.channel.create({
      data: {
        name: data.name,
        type: data.type,
        status: ChannelStatus.INACTIVE,
        config: data.config || {},
        evolutionApiKey: apiKey,
        evolutionInstanceId: instanceId,
        evolutionInstanceToken: instanceToken,
      },
    });
  }

  async updateChannel(id: string, data: Partial<CreateChannelData>): Promise<Channel> {
    return await prisma.channel.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.config && { config: data.config }),
        ...(data.evolutionApiKey && { evolutionApiKey: data.evolutionApiKey }),
        ...(data.evolutionInstanceId && { evolutionInstanceId: data.evolutionInstanceId }),
        ...(data.evolutionInstanceToken && { evolutionInstanceToken: data.evolutionInstanceToken }),
      },
    });
  }

  async updateChannelStatus(id: string, status: ChannelStatus): Promise<Channel> {
    return await prisma.channel.update({
      where: { id },
      data: { status },
    });
  }

  async deleteChannel(id: string): Promise<void> {
    console.log('[ChannelService] Iniciando exclusão de canal:', id);
    
    const channel = await prisma.channel.findUnique({ where: { id } });
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    console.log('[ChannelService] Canal encontrado:', {
      id: channel.id,
      name: channel.name,
      instanceId: channel.evolutionInstanceId,
      hasApiKey: !!channel.evolutionApiKey,
    });
    
    // Se tiver instância na Evolution API, deletar também
    if (channel.evolutionInstanceId && channel.evolutionApiKey) {
      try {
        console.log('[ChannelService] Deletando instância na Evolution API:', channel.evolutionInstanceId);
        await evolutionApi.deleteInstance(channel.evolutionInstanceId, channel.evolutionApiKey);
        console.log('[ChannelService] ✅ Instância deletada com sucesso na Evolution API');
      } catch (error: any) {
        console.error('[ChannelService] ❌ Erro ao deletar instância na Evolution API:', error.message);
        if (error.response) {
          console.error('[ChannelService] Status:', error.response.status);
          console.error('[ChannelService] Data:', JSON.stringify(error.response.data, null, 2));
        }
        // Continua com a exclusão do canal mesmo se falhar na Evolution API
        console.warn('[ChannelService] ⚠️ Continuando exclusão do canal mesmo com erro na Evolution API');
      }
    } else {
      console.log('[ChannelService] Canal não tem instância na Evolution API para deletar');
    }

    // Verificar relacionamentos
    const conversations = await prisma.conversation.findMany({
      where: { channelId: id },
      select: { id: true },
    });
    
    const contacts = await prisma.contact.findMany({
      where: { channelId: id },
      select: { id: true },
    });

    const conversationsCount = conversations.length;
    const contactsCount = contacts.length;

    console.log('[ChannelService] Relacionamentos encontrados:', {
      conversations: conversationsCount,
      contacts: contactsCount,
    });

    // Deletar em cascata: Mensagens -> Conversas -> Contatos -> Canal
    try {
      // 1. Deletar todas as mensagens das conversas deste canal
      if (conversationsCount > 0) {
        const conversationIds = conversations.map(c => c.id);
        const messagesCount = await prisma.message.deleteMany({
          where: {
            conversationId: { in: conversationIds },
          },
        });
        console.log(`[ChannelService] ✅ ${messagesCount.count} mensagem(ns) deletada(s)`);
      }

      // 2. Deletar tags de conversas (ConversationTag)
      if (conversationsCount > 0) {
        const conversationIds = conversations.map(c => c.id);
        const tagsCount = await prisma.conversationTag.deleteMany({
          where: {
            conversationId: { in: conversationIds },
          },
        });
        console.log(`[ChannelService] ✅ ${tagsCount.count} tag(s) de conversa deletada(s)`);
      }

      // 3. Deletar tickets relacionados às conversas
      if (conversationsCount > 0) {
        const conversationIds = conversations.map(c => c.id);
        const ticketsCount = await prisma.ticket.deleteMany({
          where: {
            conversationId: { in: conversationIds },
          },
        });
        console.log(`[ChannelService] ✅ ${ticketsCount.count} ticket(s) deletado(s)`);
      }

      // 4. Deletar todas as conversas do canal
      if (conversationsCount > 0) {
        const deletedConversations = await prisma.conversation.deleteMany({
          where: { channelId: id },
        });
        console.log(`[ChannelService] ✅ ${deletedConversations.count} conversa(s) deletada(s)`);
      }

      // 5. Deletar todos os contatos do canal
      if (contactsCount > 0) {
        const deletedContacts = await prisma.contact.deleteMany({
          where: { channelId: id },
        });
        console.log(`[ChannelService] ✅ ${deletedContacts.count} contato(s) deletado(s)`);
      }

      // 6. Finalmente, deletar o canal
      await prisma.channel.delete({
        where: { id },
      });
      console.log('[ChannelService] ✅ Canal deletado com sucesso');
    } catch (error: any) {
      console.error('[ChannelService] ❌ Erro ao deletar canal:', error.message);
      console.error('[ChannelService] Código:', error.code);
      console.error('[ChannelService] Stack:', error.stack?.substring(0, 500));
      throw error;
    }
  }

  async getQRCode(channelId: string): Promise<{ qrcode: string | null }> {
    const channel = await this.getChannelById(channelId);
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      throw new Error('QR Code disponível apenas para canais WhatsApp');
    }

    const apiKey = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    if (!channel.evolutionInstanceId || !apiKey) {
      throw new Error('Canal não configurado com Evolution API');
    }

    console.log('[ChannelService] Obtendo QR Code:', {
      channelId,
      instanceId: channel.evolutionInstanceId,
      hasApiKey: !!apiKey,
    });

    try {
      // Primeiro, tentar obter pelo status da instância
      console.log('[ChannelService] Tentando obter QR Code via getInstanceStatus...');
      let status;
      try {
        status = await evolutionApi.getInstanceStatus(
          channel.evolutionInstanceId,
          apiKey
        );
      } catch (statusError: any) {
        console.error('[ChannelService] Erro ao obter status, tentando conectar diretamente...', statusError.message);
        // Se falhar, tentar conectar diretamente
        status = { status: 'UNKNOWN', qrcode: null };
      }

      console.log('[ChannelService] Status da instância:', {
        status: status.status,
        hasQrcode: !!status.qrcode,
      });

      if (status.qrcode) {
        console.log('[ChannelService] ✅ QR Code obtido via getInstanceStatus');
        const cleanBase64 = status.qrcode.replace(/^data:image\/png;base64,/, '');
        return { qrcode: `data:image/png;base64,${cleanBase64}` };
      }

      // Se não encontrou, tentar conectar a instância para gerar QR Code
      console.log('[ChannelService] QR Code não encontrado no status, tentando conectar instância...');
      try {
        const qrResponse = await evolutionApi.getQRCode(
          channel.evolutionInstanceId,
          apiKey
        );

        console.log('[ChannelService] Resposta completa do getQRCode:', JSON.stringify(qrResponse, null, 2).substring(0, 1000));
        console.log('[ChannelService] Resposta do getQRCode:', {
          hasQrcode: !!qrResponse.qrcode,
          hasBase64: !!qrResponse.qrcode?.base64,
          hasBase64Direct: !!qrResponse.base64,
          keys: Object.keys(qrResponse),
        });

        // A Evolution API pode retornar o QR code em diferentes formatos (seguindo padrão do n8n)
        // Padrão: qrcode.base64 ou base64 direto
        const qrBase64 = qrResponse.qrcode?.base64 || qrResponse.base64 || 
                        (typeof qrResponse.qrcode === 'string' ? qrResponse.qrcode : null);
        
        if (qrBase64) {
          // Remover prefixo se existir (como no código do n8n)
          const cleanBase64 = qrBase64.replace(/^data:image\/png;base64,/, '');
          console.log('[ChannelService] ✅ QR Code obtido via getQRCode');
          return { qrcode: `data:image/png;base64,${cleanBase64}` };
        }

        console.warn('[ChannelService] ⚠️ QR Code não encontrado na resposta:', JSON.stringify(qrResponse, null, 2).substring(0, 500));
      } catch (qrError: any) {
        console.error('[ChannelService] Erro ao obter QR Code via getQRCode:', qrError.message);
        if (qrError.response) {
          console.error('[ChannelService] Status:', qrError.response.status);
          console.error('[ChannelService] Data:', JSON.stringify(qrError.response.data, null, 2));
        }
      }

      // Se ainda não encontrou, retornar null
      console.warn('[ChannelService] ⚠️ QR Code não disponível. A instância pode precisar ser conectada primeiro.');
      return { qrcode: null };
    } catch (error: any) {
      console.error('[ChannelService] ❌ Erro ao obter QR Code:', error.message);
      if (error.response) {
        console.error('[ChannelService] Status:', error.response.status);
        console.error('[ChannelService] Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Erro ao obter QR Code: ${error.message}`);
    }
  }

  async getChannelStatus(channelId: string): Promise<{ status: string }> {
    const channel = await this.getChannelById(channelId);
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      return { status: channel.status };
    }

    if (!channel.evolutionInstanceId || !channel.evolutionApiKey) {
      return { status: channel.status };
    }

    try {
      const evolutionStatus = await evolutionApi.getInstanceStatus(
        channel.evolutionInstanceId,
        channel.evolutionApiKey
      );

      // Atualizar token se disponível e diferente
      if (evolutionStatus.token && evolutionStatus.token !== channel.evolutionInstanceToken) {
        console.log('[ChannelService] Atualizando token da instância...');
        await prisma.channel.update({
          where: { id: channelId },
          data: { evolutionInstanceToken: evolutionStatus.token },
        });
        console.log('[ChannelService] ✅ Token atualizado com sucesso');
      }

      // Atualizar status no banco se mudou
      if (evolutionStatus.status === 'open' && channel.status !== ChannelStatus.ACTIVE) {
        await this.updateChannelStatus(channelId, ChannelStatus.ACTIVE);
        
        // Configurar webhook quando o canal é conectado
        console.log('[ChannelService] Canal conectado! Configurando webhook...');
        try {
          await this.configureWebhook(channel.evolutionInstanceId!, channel.evolutionApiKey!);
        } catch (webhookError: any) {
          console.error('[ChannelService] ⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
          // Não bloqueia a atualização de status se o webhook falhar
        }
        
        return { status: 'ACTIVE' };
      }

      if (evolutionStatus.status === 'close' && channel.status !== ChannelStatus.INACTIVE) {
        await this.updateChannelStatus(channelId, ChannelStatus.INACTIVE);
        return { status: 'INACTIVE' };
      }

      return { status: channel.status };
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      return { status: channel.status };
    }
  }
}
