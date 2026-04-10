import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChannelService } from '../services/channelService';
import prisma from '../config/database';

const channelService = new ChannelService();

export class ChannelController {
  async getHealthPanel(req: AuthRequest, res: Response) {
    try {
      const channels = await prisma.channel.findMany({
        include: {
          conversations: {
            select: {
              id: true,
              lastMessageAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const items = channels.map((channel) => {
        const cfg = (channel.config || {}) as any;
        const provider = String(cfg.provider || (channel.type === 'WHATSAPP' ? 'evolution' : 'native'));
        const isWhatsAppOfficial = provider === 'whatsapp_official' || provider === 'meta';
        const hasToken = !!(cfg.token && String(cfg.token).trim());
        const hasPhoneNumberId = !!(cfg.phoneNumberId && String(cfg.phoneNumberId).trim());
        const hasWabaId = !!(cfg.businessAccountId && String(cfg.businessAccountId).trim());
        const hasVerifyToken = !!(
          (cfg.webhookVerifyToken && String(cfg.webhookVerifyToken).trim()) ||
          (cfg.verifyToken && String(cfg.verifyToken).trim()) ||
          (cfg.metaWebhookVerifyToken && String(cfg.metaWebhookVerifyToken).trim())
        );

        const credentialsOk = !isWhatsAppOfficial || (hasToken && hasPhoneNumberId && hasWabaId);
        const webhookReady = !isWhatsAppOfficial || hasVerifyToken;
        const conversationCount = channel.conversations.length;
        const lastActivityAt = channel.conversations
          .map((c) => c.lastMessageAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b as Date).getTime() - new Date(a as Date).getTime())[0] || null;

        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          status: channel.status,
          provider,
          checks: {
            credentialsOk,
            webhookReady,
            hasToken,
            hasPhoneNumberId,
            hasWabaId,
            hasVerifyToken,
          },
          metrics: {
            conversationCount,
            lastActivityAt,
          },
        };
      });

      const summary = {
        total: items.length,
        active: items.filter((i) => i.status === 'ACTIVE').length,
        withIssues: items.filter((i) => !i.checks.credentialsOk || !i.checks.webhookReady).length,
      };

      res.json({ summary, items });
    } catch (error: any) {
      console.error('[ChannelController] ❌ Erro ao montar painel de saúde:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getChannels(req: AuthRequest, res: Response) {
    try {
      console.log('[ChannelController] 📡 Buscando canais...');
      const channels = await channelService.getChannels();
      console.log(`[ChannelController] ✅ ${channels.length} canal(is) encontrado(s):`, channels.map(c => ({ id: c.id, name: c.name, status: c.status })));
      res.json(channels);
    } catch (error: any) {
      console.error('[ChannelController] ❌ Erro ao buscar canais:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getChannelById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const channel = await channelService.getChannelById(id);

      if (!channel) {
        return res.status(404).json({ error: 'Canal não encontrado' });
      }

      res.json(channel);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createChannel(req: AuthRequest, res: Response) {
    try {
      const {
        name,
        type,
        config,
        evolutionApiKey,
        evolutionInstanceId,
        evolutionInstanceToken,
        // novo modelo
        primarySectorId,
        secondarySectorIds,
        // legado
        sectorId,
      } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
      }

      // Verificar se é WhatsApp Official (não usa Evolution API)
      const hasEvolutionApiKey = evolutionApiKey || process.env.EVOLUTION_API_KEY;
      const isWhatsAppOfficial =
        type === 'WHATSAPP' &&
        (config?.provider === 'whatsapp_official' ||
          (!hasEvolutionApiKey && process.env.WHATSAPP_ENV));

      // Configurar config com provider se for WhatsApp Official
      const channelConfig = config || {};
      if (isWhatsAppOfficial) {
        channelConfig.provider = 'whatsapp_official';
        // Preferir dados enviados pela interface; se não vierem, usar fallback do .env
        channelConfig.phoneNumberId =
          channelConfig.phoneNumberId ||
          process.env.WHATSAPP_DEV_PHONE_NUMBER_ID ||
          process.env.WHATSAPP_PHONE_NUMBER_ID;
        channelConfig.businessAccountId =
          channelConfig.businessAccountId ||
          process.env.WHATSAPP_DEV_WABA_ID ||
          process.env.WHATSAPP_WABA_ID;
      }

      // Usar API key do .env apenas se não for WhatsApp Official
      const apiKey = isWhatsAppOfficial ? undefined : (evolutionApiKey || process.env.EVOLUTION_API_KEY);

      console.log('[ChannelController] Criando canal:', {
        name,
        type,
        isWhatsAppOfficial,
        hasApiKey: !!apiKey,
        hasConfig: !!channelConfig.provider,
      });

      const channel = await channelService.createChannel({
        name,
        type,
        config: channelConfig,
        evolutionApiKey: apiKey,
        primarySectorId: primarySectorId || sectorId,
        secondarySectorIds,
        evolutionInstanceId,
        evolutionInstanceToken,
      });

      res.status(201).json(channel);
    } catch (error: any) {
      console.error('[ChannelController] Erro ao criar canal:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateChannel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        config,
        evolutionApiKey,
        evolutionInstanceId,
        evolutionInstanceToken,
        primarySectorId,
        secondarySectorIds,
        // legado
        sectorId,
      } = req.body;

      const channel = await channelService.updateChannel(id, {
        name,
        config,
        evolutionApiKey,
        evolutionInstanceId,
        evolutionInstanceToken,
        primarySectorId,
        secondarySectorIds,
        sectorId,
      });

      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteChannel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await channelService.deleteChannel(id);
      res.json({ message: 'Canal deletado com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getQRCode(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await channelService.getQRCode(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await channelService.getChannelStatus(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async configureWebhook(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await channelService.configureWebhookManually(id);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          webhookUrl: result.webhookUrl,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          webhookUrl: result.webhookUrl,
        });
      }
    } catch (error: any) {
      res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  async checkWhatsAppOfficial(req: AuthRequest, res: Response) {
    try {
      // Buscar todos os canais WhatsApp
      const whatsappChannels = await prisma.channel.findMany({
        where: {
          type: 'WHATSAPP',
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          config: true,
          evolutionInstanceId: true,
          evolutionApiKey: true,
          createdAt: true,
        },
      });

      // Verificar quais são Official
      const officialChannels = whatsappChannels.filter((channel) => {
        const config = channel.config as any;
        return config?.provider === 'whatsapp_official';
      });

      const evolutionChannels = whatsappChannels.filter((channel) => {
        const config = channel.config as any;
        return !config?.provider || config?.provider === 'evolution';
      });

      res.json({
        total: whatsappChannels.length,
        official: officialChannels.length,
        evolution: evolutionChannels.length,
        channels: whatsappChannels.map((channel) => {
          const config = channel.config as any;
          const isOfficial = config?.provider === 'whatsapp_official';
          return {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            status: channel.status,
            provider: config?.provider || 'evolution',
            isOfficial,
            phoneNumberId: isOfficial ? config?.phoneNumberId : null,
            businessAccountId: isOfficial ? config?.businessAccountId : null,
            evolutionInstanceId: !isOfficial ? channel.evolutionInstanceId : null,
            hasEvolutionApiKey: !isOfficial ? !!channel.evolutionApiKey : false,
            createdAt: channel.createdAt,
          };
        }),
      });
    } catch (error: any) {
      console.error('[ChannelController] ❌ Erro ao verificar canais WhatsApp Official:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
