import prisma from '../config/database';
import { Channel, ChannelType, ChannelStatus } from '@prisma/client';
import {
  getBaileysApi,
  getBaileysWebhookPath,
  getWhatsAppChannelProvider,
  resolveBaileysApiKey,
  resolveBaileysGlobalApiKey,
  resolveDefaultBaileysApiKey,
  type WhatsAppChannelProvider,
} from '../utils/channelWhatsAppProvider';
import { toEvolutionInstanceName } from '../utils/evolutionInstanceName';
import { getSocketIO } from '../routes/webhookRoutes';
import { emitChannelStatusUpdate } from '../utils/realtimeEvents';
import { encryptField, encryptConfigSecrets, decryptField } from '../utils/fieldEncryption';
import { sanitizeChannelForRead } from '../utils/channelSanitizer';

export interface CreateChannelData {
  name: string;
  type: ChannelType;
  config?: any;
  evolutionApiKey?: string;
  evolutionInstanceId?: string;
  evolutionInstanceToken?: string;
  // setor principal (legado: sectorId)
  primarySectorId?: string;
  sectorId?: string; // legado: tratado como primarySectorId
  // setores secundários
  secondarySectorIds?: string[];
}

export class ChannelService {
  private static readonly SECRET_MASK = '***';
  private static readonly SECRET_CONFIG_KEYS = new Set([
    'token',
    'appSecret',
    'apiKey',
    'secret',
    'webhookSecret',
    'metaAppSecret',
    'whatsappAppSecret',
    'accessToken',
  ]);

  private sanitizeChannelForRead<T extends Record<string, any>>(channel: T): T {
    return sanitizeChannelForRead(channel) as T;
  }

  private mergeConfigPreservingSecrets(previousConfig: any, incomingConfig: any): any {
    const prev = previousConfig && typeof previousConfig === 'object' ? previousConfig : {};
    const next = incomingConfig && typeof incomingConfig === 'object' ? { ...incomingConfig } : {};

    for (const key of ChannelService.SECRET_CONFIG_KEYS) {
      const incoming = next[key];
      if (
        incoming === undefined ||
        incoming === null ||
        incoming === '' ||
        incoming === ChannelService.SECRET_MASK
      ) {
        if (prev[key] !== undefined) {
          next[key] = prev[key];
        } else {
          delete next[key];
        }
      }
    }

    return next;
  }

  private isWhatsAppOfficialConfig(config: any): boolean {
    return config?.provider === 'whatsapp_official';
  }

  private resolveEvolutionApiKey(
    storedKey?: string | null,
    provider: WhatsAppChannelProvider = 'evolution',
  ): string | undefined {
    const decrypted = decryptField(storedKey);
    if (decrypted && decrypted !== ChannelService.SECRET_MASK) {
      return decrypted;
    }
    return resolveDefaultBaileysApiKey(provider);
  }

  private async provisionEvolutionInstance(
    channelName: string,
    apiKey: string,
    provider: WhatsAppChannelProvider,
  ): Promise<{
    instanceId: string;
    instanceToken?: string | null;
    instanceDisplayName?: string;
  }> {
    const instanceName = toEvolutionInstanceName(channelName);
    const baileysApi = getBaileysApi({ config: { provider } });
    console.log('[ChannelService] Provisionando instância Baileys:', {
      channelName,
      instanceName,
      provider,
      evolutionGoUrl: provider === 'evolution_go' ? process.env.EVOLUTION_GO_API_URL : undefined,
    });

    const evolutionResponse = await baileysApi.createInstance(instanceName, apiKey, true);

    if (provider === 'evolution_go') {
      const instanceUuid =
        (evolutionResponse.instance as { instanceUuid?: string })?.instanceUuid ||
        evolutionResponse.instance?.instanceName;
      const instanceToken = evolutionResponse.instance?.token ?? null;
      const displayName =
        (evolutionResponse.instance as { instanceName?: string })?.instanceName || instanceName;

      if (!instanceUuid) {
        throw new Error('Evolution GO não retornou UUID da instância após /instance/create');
      }

      const webhookUrl = this.getWebhookUrl({ config: { provider: 'evolution_go' } });
      // Connect pode demorar (Baileys); não bloqueia a criação do canal no CRM.
      void baileysApi
        .setWebhook(instanceUuid, webhookUrl || '', instanceToken || undefined)
        .then(() => {
        console.log('[ChannelService] ✅ Evolution GO connect/webhook em background OK:', instanceUuid);
      }).catch((connectError: any) => {
        console.warn(
          '[ChannelService] ⚠️ Instância GO criada; connect/webhook em background falhou (tente QR de novo):',
          connectError?.message || connectError,
        );
      });

      console.log('[ChannelService] Instância Evolution GO provisionada:', {
        instanceUuid,
        displayName,
        hasToken: !!instanceToken,
        webhookUrl: webhookUrl || null,
      });

      return {
        instanceId: instanceUuid,
        instanceToken,
        instanceDisplayName: displayName,
      };
    }

    const instanceId = evolutionResponse.instance?.instanceName || instanceName;
    const instanceToken = evolutionResponse.instance?.token ?? null;

    console.log('[ChannelService] Instância provisionada:', {
      instanceId,
      hasToken: !!instanceToken,
      provider,
    });

    return { instanceId, instanceToken, instanceDisplayName: instanceName };
  }

  private async removeEvolutionInstance(
    instanceId: string,
    apiKey: string,
    provider: WhatsAppChannelProvider,
  ): Promise<void> {
    const baileysApi = getBaileysApi({ config: { provider } });
    try {
      console.log('[ChannelService] Removendo instância:', { instanceId, provider });
      await baileysApi.deleteInstance(instanceId, apiKey);
      console.log('[ChannelService] Instância removida:', instanceId);
    } catch (error: any) {
      const message = error.message || String(error);
      if (/not found|404/i.test(message)) {
        console.log('[ChannelService] Instância já inexistente:', instanceId);
        return;
      }
      console.error('[ChannelService] Erro ao remover instância:', instanceId, message);
      throw error;
    }
  }

  /**
   * Obtém a URL do webhook (prioriza NGROK_URL para ambiente de teste)
   */
  private getWebhookUrl(channelConfig?: unknown): string | null {
    const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
    if (webhookBaseUrl) {
      return `${webhookBaseUrl}${getBaileysWebhookPath({ config: channelConfig })}`;
    }
    return null;
  }

  /**
   * Configura o webhook na API Baileys (Evolution ou Evolution GO) para uma instância
   */
  private async configureWebhook(
    instanceId: string,
    instanceToken: string,
    channelConfig?: unknown,
  ): Promise<void> {
    const webhookUrl = this.getWebhookUrl(channelConfig);
    const baileysApi = getBaileysApi({ config: channelConfig });
    if (!webhookUrl) {
      console.warn('[ChannelService] ⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
      console.warn('[ChannelService] Configure NGROK_URL no .env para ambiente de desenvolvimento');
      return;
    }

    try {
      console.log('[ChannelService] ============================================');
      console.log('[ChannelService] 📡 CONFIGURANDO WEBHOOK');
      console.log('[ChannelService] Instância:', instanceId);
      console.log('[ChannelService] Token da Instância:', instanceToken ? `${instanceToken.substring(0, 10)}...` : 'NÃO ENCONTRADO');
      console.log('[ChannelService] URL do Webhook:', webhookUrl);
      console.log('[ChannelService] Usando ngrok:', !!process.env.NGROK_URL);
      console.log('[ChannelService] ============================================');

      if (!instanceToken) {
        throw new Error('Token da instância não encontrado. Aguarde a instância conectar primeiro.');
      }

      // Verificar webhook atual (se possível)
      try {
        const currentWebhook = await baileysApi.getWebhook(instanceId, instanceToken);
        if (currentWebhook) {
          console.log('[ChannelService] ℹ️ Webhook atual encontrado:', JSON.stringify(currentWebhook, null, 2).substring(0, 500));
        }
      } catch (checkError) {
        console.log('[ChannelService] ℹ️ Não foi possível verificar webhook atual (normal se endpoint não existir)');
      }

      // Configurar novo webhook - usar token da instância ao invés da API key
      const result = await baileysApi.setWebhook(instanceId, webhookUrl, instanceToken);
      
      console.log('[ChannelService] ============================================');
      console.log('[ChannelService] ✅ WEBHOOK CONFIGURADO COM SUCESSO!');
      console.log('[ChannelService] Resposta:', JSON.stringify(result, null, 2).substring(0, 500));
      console.log('[ChannelService] ============================================');
    } catch (error: any) {
      console.error('[ChannelService] ============================================');
      console.error('[ChannelService] ❌ ERRO AO CONFIGURAR WEBHOOK');
      console.error('[ChannelService] Instância:', instanceId);
      console.error('[ChannelService] URL do Webhook:', webhookUrl);
      console.error('[ChannelService] Erro:', error.message);
      if (error.response) {
        console.error('[ChannelService] Status HTTP:', error.response.status);
        console.error('[ChannelService] Status Text:', error.response.statusText);
        console.error('[ChannelService] Dados do erro:', JSON.stringify(error.response.data, null, 2));
        console.error('[ChannelService] Headers da resposta:', JSON.stringify(error.response.headers, null, 2));
      }
      if (error.config) {
        console.error('[ChannelService] URL da requisição:', error.config.url);
        console.error('[ChannelService] Método:', error.config.method);
        console.error('[ChannelService] Payload enviado:', error.config.data ? JSON.stringify(JSON.parse(error.config.data), null, 2) : 'N/A');
        console.error('[ChannelService] Headers enviados:', JSON.stringify(error.config.headers, null, 2));
      }
      console.error('[ChannelService] Stack trace:', error.stack);
      console.error('[ChannelService] ============================================');
      throw error;
    }
  }

  /**
   * Configura o webhook manualmente (método público)
   */
  async configureWebhookManually(channelId: string): Promise<{ success: boolean; message: string; webhookUrl?: string }> {
    const channel = await this.getChannelByIdRaw(channelId);
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      throw new Error('Webhook disponível apenas para canais WhatsApp');
    }

    if (!channel.evolutionInstanceId || !resolveBaileysApiKey(channel)) {
      throw new Error('Canal não configurado com Evolution / Evolution GO');
    }

    const webhookUrl = this.getWebhookUrl(channel.config);
    if (!webhookUrl) {
      return {
        success: false,
        message: 'NGROK_URL ou APP_URL não configurado no .env',
      };
    }

    if (!channel.evolutionInstanceToken) {
      return {
        success: false,
        message: 'Token da instância não encontrado. Aguarde a instância conectar primeiro.',
        webhookUrl,
      };
    }

    try {
      await this.configureWebhook(
        channel.evolutionInstanceId!,
        channel.evolutionInstanceToken,
        channel.config,
      );
      return {
        success: true,
        message: 'Webhook configurado com sucesso',
        webhookUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Erro ao configurar webhook',
        webhookUrl,
      };
    }
  }

  async getChannels(): Promise<Channel[]> {
    const channels = await prisma.channel.findMany({
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return channels.map((channel) => this.sanitizeChannelForRead(channel as any)) as Channel[];
  }

  private async getChannelByIdRaw(id: string): Promise<Channel | null> {
    return prisma.channel.findUnique({
      where: { id },
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
          },
        },
      },
    });
  }

  async getChannelById(id: string): Promise<Channel | null> {
    const channel = await this.getChannelByIdRaw(id);
    return channel ? (this.sanitizeChannelForRead(channel as any) as Channel) : null;
  }

  async createChannel(data: CreateChannelData): Promise<Channel> {
    let instanceId = data.evolutionInstanceId;
    let instanceToken = data.evolutionInstanceToken;

    const provider = getWhatsAppChannelProvider(data.config as Record<string, unknown>);
    const isWhatsAppOfficial = provider === 'whatsapp_official';

    const apiKey = !isWhatsAppOfficial
      ? data.evolutionApiKey || resolveDefaultBaileysApiKey(provider)
      : undefined;

    let mergedConfig = { ...(data.config || {}) } as Record<string, unknown>;

    if (data.type === ChannelType.WHATSAPP && apiKey && !instanceId && !isWhatsAppOfficial) {
      try {
        const provisioned = await this.provisionEvolutionInstance(data.name, apiKey, provider);
        instanceId = provisioned.instanceId;
        instanceToken = provisioned.instanceToken ?? undefined;
        if (provider === 'evolution_go' && provisioned.instanceDisplayName) {
          mergedConfig.evolutionInstanceName = provisioned.instanceDisplayName;
        }
      } catch (error: any) {
        console.error('[ChannelService] Erro ao provisionar instância:', error.message);
        if (provider === 'evolution_go') {
          throw new Error(
            `Não foi possível criar a instância na Evolution GO: ${error.message}. Verifique EVOLUTION_GO_API_URL e EVOLUTION_GO_API_KEY no CRM.`,
          );
        }
        // Evolution Node: mantém comportamento anterior (canal sem instância)
      }
    }

    const rawPrimary = data.primarySectorId ?? data.sectorId;
    const normalizedPrimarySectorId =
      rawPrimary && rawPrimary.trim() !== '' ? rawPrimary : undefined;

    const secondarySectorIds = (data.secondarySectorIds || [])
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter((id) => id.length > 0);

    // Para WhatsApp Official, status deve ser ACTIVE (não precisa de QR code)
    const channelStatus = isWhatsAppOfficial ? ChannelStatus.ACTIVE : ChannelStatus.INACTIVE;
    
    const channel = await prisma.channel.create({
      data: {
        name: data.name,
        type: data.type,
        status: channelStatus,
        config: encryptConfigSecrets(mergedConfig) as object,
        evolutionApiKey: apiKey ? encryptField(apiKey) : null,
        evolutionInstanceId: instanceId || null,
        evolutionInstanceToken: instanceToken ? encryptField(instanceToken) : null,
        sectorId: normalizedPrimarySectorId,
      },
    });

    if (secondarySectorIds.length > 0) {
      const filteredSecondary = normalizedPrimarySectorId
        ? secondarySectorIds.filter((sid) => sid !== normalizedPrimarySectorId)
        : secondarySectorIds;

      if (filteredSecondary.length > 0) {
        await prisma.channelSector.createMany({
          data: filteredSecondary.map((sectorId) => ({ channelId: channel.id, sectorId })),
          skipDuplicates: true,
        });
      }
    }

    return channel;
  }

  async updateChannel(id: string, data: Partial<CreateChannelData>): Promise<Channel> {
    const existingChannel = await prisma.channel.findUnique({
      where: { id },
    });
    if (!existingChannel) {
      throw new Error('Canal não encontrado');
    }

    const rawPrimary = data.primarySectorId ?? data.sectorId;
    const normalizedPrimarySectorId =
      rawPrimary && rawPrimary.trim() !== '' ? rawPrimary : null;

    const shouldUpdateSectors = data.primarySectorId !== undefined || data.secondarySectorIds !== undefined;

    const trimmedName = typeof data.name === 'string' ? data.name.trim() : '';
    const isRename = trimmedName.length > 0 && trimmedName !== existingChannel.name;

    let evolutionSync:
      | {
          evolutionInstanceId: string;
          evolutionInstanceToken: string | null;
          status: ChannelStatus;
        }
      | undefined;

    if (
      isRename &&
      existingChannel.type === ChannelType.WHATSAPP &&
      !this.isWhatsAppOfficialConfig(existingChannel.config) &&
      existingChannel.evolutionInstanceId
    ) {
      const provider = getWhatsAppChannelProvider(existingChannel.config as Record<string, unknown>);
      const apiKey = this.resolveEvolutionApiKey(existingChannel.evolutionApiKey, provider);
      if (apiKey) {
        const oldInstanceId = existingChannel.evolutionInstanceId;
        try {
          await this.removeEvolutionInstance(oldInstanceId, apiKey, provider);
          const provisioned = await this.provisionEvolutionInstance(trimmedName, apiKey, provider);
          evolutionSync = {
            evolutionInstanceId: provisioned.instanceId,
            evolutionInstanceToken: provisioned.instanceToken
              ? encryptField(provisioned.instanceToken)
              : null,
            status: ChannelStatus.INACTIVE,
          };
          console.log('[ChannelService] Instância Evolution recriada após renomear canal:', {
            oldInstanceId,
            newInstanceId: provisioned.instanceId,
            channelName: trimmedName,
          });
        } catch (error: any) {
          throw new Error(
            `Não foi possível sincronizar o novo nome na Evolution API: ${error.message}`
          );
        }
      }
    }

    const updated = await prisma.channel.update({
      where: { id },
      data: {
        ...(isRename && { name: trimmedName }),
        ...(data.config && {
          config: encryptConfigSecrets(
            this.mergeConfigPreservingSecrets(existingChannel.config as any, data.config),
          ),
        }),
        ...(data.evolutionApiKey && { evolutionApiKey: encryptField(data.evolutionApiKey) }),
        ...(data.evolutionInstanceId && { evolutionInstanceId: data.evolutionInstanceId }),
        ...(data.evolutionInstanceToken && {
          evolutionInstanceToken: encryptField(data.evolutionInstanceToken),
        }),
        ...(data.primarySectorId !== undefined || data.sectorId !== undefined
          ? { sectorId: normalizedPrimarySectorId }
          : {}),
        ...(evolutionSync || {}),
      },
    });

    if (shouldUpdateSectors) {
      const primary = normalizedPrimarySectorId || null;
      const secondarySectorIds = (data.secondarySectorIds || [])
        .map((sid) => (typeof sid === 'string' ? sid.trim() : ''))
        .filter((sid) => sid.length > 0);

      // Se veio primary mas veio sem secondary, limpamos e recriamos o que foi enviado.
      await prisma.channelSector.deleteMany({
        where: { channelId: id },
      });

      const filteredSecondary = primary
        ? secondarySectorIds.filter((sid) => sid !== primary)
        : secondarySectorIds;

      if (filteredSecondary.length > 0) {
        await prisma.channelSector.createMany({
          data: filteredSecondary.map((sectorId) => ({ channelId: id, sectorId })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
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
      console.log('[ChannelService] Canal já removido (delete idempotente):', id);
      return;
    }

    console.log('[ChannelService] Canal encontrado:', {
      id: channel.id,
      name: channel.name,
      instanceId: channel.evolutionInstanceId,
      hasApiKey: !!channel.evolutionApiKey || !!process.env.EVOLUTION_API_KEY,
    });

    const conversationsCount = await prisma.conversation.count({
      where: { channelId: id },
    });

    console.log('[ChannelService] Conversas vinculadas (histórico preservado):', conversationsCount);

    const conversationsWithoutSnapshot = await prisma.conversation.findMany({
      where: { channelId: id, channelSnapshot: { equals: null } as never },
      include: { channel: true },
    });
    for (const conv of conversationsWithoutSnapshot) {
      if (!conv.channel) continue;
      const { buildChannelSnapshot, snapshotToPrismaJson } = await import('../utils/channelSnapshot');
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { channelSnapshot: snapshotToPrismaJson(buildChannelSnapshot(conv.channel)) },
      });
    }

    await prisma.contactChannelIdentity.deleteMany({ where: { channelId: id } });

    const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
    const apiKey = this.resolveEvolutionApiKey(channel.evolutionApiKey, provider);
    const shouldDeleteEvolution =
      channel.type === ChannelType.WHATSAPP &&
      !!channel.evolutionInstanceId &&
      !!apiKey &&
      !this.isWhatsAppOfficialConfig(channel.config);

    if (shouldDeleteEvolution) {
      try {
        await this.removeEvolutionInstance(channel.evolutionInstanceId!, apiKey!, provider);
      } catch (error: any) {
        console.warn(
          '[ChannelService] Continuando exclusão do canal após falha na Evolution API:',
          error.message
        );
      }
    } else {
      console.log('[ChannelService] Canal sem instância Evolution para remover');
    }

    const stillExists = await prisma.channel.findUnique({ where: { id }, select: { id: true } });
    if (!stillExists) {
      console.log('[ChannelService] Canal já removido antes do delete no banco:', id);
      return;
    }

    try {
      await prisma.channel.delete({
        where: { id },
      });

      console.log('[ChannelService] Canal deletado com sucesso');
    } catch (error: any) {
      if (error?.code === 'P2025') {
        console.log('[ChannelService] Canal já removido (P2025):', id);
        return;
      }
      console.error('[ChannelService] Erro ao deletar canal:', error.message);
      console.error('[ChannelService] Código:', error.code);
      console.error('[ChannelService] Stack:', error.stack?.substring(0, 500));
      throw error;
    }
  }

  async getQRCode(
    channelId: string,
  ): Promise<{ qrcode: string | null; connected?: boolean; status?: string }> {
    const channel = await this.getChannelByIdRaw(channelId);
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      throw new Error('QR Code disponível apenas para canais WhatsApp');
    }

    const baileysApi = getBaileysApi(channel);
    const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
    const globalApiKey = resolveBaileysGlobalApiKey(channel);
    const instanceAuthKey = resolveBaileysApiKey(channel);
    if (!channel.evolutionInstanceId || !globalApiKey) {
      throw new Error('Canal não configurado com Evolution / Evolution GO');
    }

    console.log('[ChannelService] Obtendo QR Code:', {
      channelId,
      instanceId: channel.evolutionInstanceId,
      hasGlobalApiKey: !!globalApiKey,
      hasInstanceAuth: !!instanceAuthKey,
      provider,
    });

    try {
      const liveStatus = await this.getChannelStatus(channelId);
      if (liveStatus.status === 'ACTIVE') {
        console.log('[ChannelService] Instância já conectada; QR não necessário');
        return { qrcode: null, connected: true, status: 'ACTIVE' };
      }

      if (provider === 'evolution_go') {
        const webhookUrl = this.getWebhookUrl(channel.config);
        const connectToken = instanceAuthKey || channel.evolutionInstanceToken || undefined;
        if (connectToken) {
          try {
            console.log('[ChannelService] Evolution GO: connect antes do QR...');
            await baileysApi.setWebhook(
              channel.evolutionInstanceId,
              webhookUrl || '',
              connectToken,
            );
          } catch (connectErr: any) {
            console.warn('[ChannelService] Evolution GO connect antes do QR:', connectErr?.message);
          }
        } else {
          console.warn(
            '[ChannelService] Evolution GO: sem evolutionInstanceToken no canal; connect/QR pode falhar',
          );
        }
      }

      // Primeiro, tentar obter pelo status da instância
      console.log('[ChannelService] Tentando obter QR Code via getInstanceStatus...');
      let status;
      try {
        status = await baileysApi.getInstanceStatus(
          channel.evolutionInstanceId,
          globalApiKey,
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
        const qrResponse = await baileysApi.getQRCode(
          channel.evolutionInstanceId,
          instanceAuthKey || globalApiKey,
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

  async cancelPairing(
    channelId: string,
  ): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
    const channel = await this.getChannelByIdRaw(channelId);

    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      return { success: true, skipped: true, reason: 'not_whatsapp' };
    }

    const liveStatus = await this.getChannelStatus(channelId);
    if (liveStatus.status === 'ACTIVE') {
      return { success: true, skipped: true, reason: 'already_connected' };
    }

    const baileysApi = getBaileysApi(channel);
    const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
    const globalApiKey = resolveBaileysGlobalApiKey(channel);
    const instanceAuthKey = resolveBaileysApiKey(channel);

    if (!channel.evolutionInstanceId || !globalApiKey) {
      return { success: true, skipped: true, reason: 'not_configured' };
    }

    const authKey =
      provider === 'evolution_go'
        ? instanceAuthKey || channel.evolutionInstanceToken || undefined
        : globalApiKey;

    try {
      console.log('[ChannelService] Cancelando pareamento:', {
        channelId,
        provider,
        instanceId: channel.evolutionInstanceId,
      });
      await baileysApi.disconnectInstance(channel.evolutionInstanceId, authKey);
      console.log('[ChannelService] Pareamento cancelado com sucesso');
    } catch (error: any) {
      console.warn('[ChannelService] cancelPairing (best-effort):', error.message);
    }

    return { success: true };
  }

  async getChannelStatus(channelId: string): Promise<{ status: string }> {
    const channel = await this.getChannelByIdRaw(channelId);
    
    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    if (channel.type !== ChannelType.WHATSAPP) {
      return { status: channel.status };
    }

    const baileysApi = getBaileysApi(channel);
    const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
    const globalApiKey = resolveBaileysGlobalApiKey(channel);
    const instanceToken =
      channel.evolutionInstanceToken && channel.evolutionInstanceToken !== ChannelService.SECRET_MASK
        ? channel.evolutionInstanceToken
        : undefined;
    if (!channel.evolutionInstanceId || !globalApiKey) {
      return { status: channel.status };
    }

    try {
      const evolutionStatus = await baileysApi.getInstanceStatus(
        channel.evolutionInstanceId,
        globalApiKey,
        provider === 'evolution_go' ? instanceToken : undefined,
      );

      // Atualizar token se disponível e diferente
      if (evolutionStatus.token && evolutionStatus.token !== channel.evolutionInstanceToken) {
        console.log('[ChannelService] Atualizando token da instância...');
        await prisma.channel.update({
          where: { id: channelId },
          data: { evolutionInstanceToken: encryptField(evolutionStatus.token) },
        });
        console.log('[ChannelService] ✅ Token atualizado com sucesso');
      }

      // Normalizar status - Evolution API pode retornar em diferentes formatos
      const normalizedStatus = (evolutionStatus.status || '').toLowerCase();
      const isConnected =
        normalizedStatus === 'open' ||
        normalizedStatus === 'connected' ||
        normalizedStatus === 'ready' ||
        normalizedStatus === 'authenticated';
      const isDisconnected = normalizedStatus === 'close' || 
                            normalizedStatus === 'closed' || 
                            normalizedStatus === 'disconnected' ||
                            normalizedStatus === 'logout';

      console.log('[ChannelService] Status da instância:', {
        rawStatus: evolutionStatus.status,
        normalizedStatus,
        isConnected,
        isDisconnected,
        currentChannelStatus: channel.status,
      });

      // Atualizar status no banco se mudou
      if (isConnected && channel.status !== ChannelStatus.ACTIVE) {
        console.log('[ChannelService] ✅ Detectada conexão! Atualizando status para ACTIVE...');
        await this.updateChannelStatus(channelId, ChannelStatus.ACTIVE);

        const io = getSocketIO();
        if (io) {
          emitChannelStatusUpdate(io, { channelId, status: 'ACTIVE' });
        }

        // Configurar webhook quando o canal é conectado
        console.log('[ChannelService] Canal conectado! Configurando webhook...');
        const webhookToken = evolutionStatus.token || instanceToken || channel.evolutionInstanceToken;
        if (webhookToken) {
          try {
            await this.configureWebhook(
              channel.evolutionInstanceId!,
              webhookToken,
              channel.config,
            );
          } catch (webhookError: any) {
            console.error('[ChannelService] ⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
            // Não bloqueia a atualização de status se o webhook falhar
          }
        } else {
          console.warn('[ChannelService] ⚠️ Token da instância não encontrado. Webhook não será configurado.');
        }
        
        return { status: 'ACTIVE' };
      }

      if (isDisconnected && channel.status !== ChannelStatus.INACTIVE) {
        console.log('[ChannelService] ⚠️ Detectada desconexão! Atualizando status para INACTIVE...');
        await this.updateChannelStatus(channelId, ChannelStatus.INACTIVE);
        return { status: 'INACTIVE' };
      }

      if (isConnected) {
        return { status: 'ACTIVE' };
      }

      console.log('[ChannelService] Status não mudou:', {
        evolutionStatus: evolutionStatus.status,
        channelStatus: channel.status,
      });

      return { status: channel.status };
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      return { status: channel.status };
    }
  }
}
