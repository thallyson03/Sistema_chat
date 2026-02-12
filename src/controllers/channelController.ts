import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChannelService } from '../services/channelService';

const channelService = new ChannelService();

export class ChannelController {
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
      const { name, type, config, evolutionApiKey, evolutionInstanceId, evolutionInstanceToken, sectorId } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
      }

      // Usar API key do .env se não for fornecida
      const apiKey = evolutionApiKey || process.env.EVOLUTION_API_KEY;

      const channel = await channelService.createChannel({
        name,
        type,
        config,
        evolutionApiKey: apiKey,
        sectorId,
        evolutionInstanceId,
        evolutionInstanceToken,
      });

      res.status(201).json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateChannel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, config, evolutionApiKey, evolutionInstanceId, evolutionInstanceToken, sectorId } = req.body;

      const channel = await channelService.updateChannel(id, {
        name,
        config,
        evolutionApiKey,
        evolutionInstanceId,
        evolutionInstanceToken,
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
}
