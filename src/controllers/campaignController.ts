import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CampaignService } from '../services/campaignService';

const campaignService = new CampaignService();

export class CampaignController {
  async createCampaign(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const {
        name,
        description,
        channelId,
        content,
        messageType,
        mediaUrl,
        fileName,
        caption,
        scheduledFor,
      } = req.body;

      if (!name || !channelId || !content) {
        return res.status(400).json({ error: 'Nome, canal e conteúdo são obrigatórios' });
      }

      const campaign = await campaignService.createCampaign({
        name,
        description,
        channelId,
        userId: req.user.id,
        content,
        messageType,
        mediaUrl,
        fileName,
        caption,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      });

      res.status(201).json(campaign);
    } catch (error: any) {
      console.error('Erro ao criar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getCampaigns(req: AuthRequest, res: Response) {
    try {
      const campaigns = await campaignService.getCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      console.error('Erro ao listar campanhas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getCampaignById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const campaign = await campaignService.getCampaignById(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
      }

      res.json(campaign);
    } catch (error: any) {
      console.error('Erro ao buscar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateCampaign(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const campaign = await campaignService.updateCampaign(id, data);
      res.json(campaign);
    } catch (error: any) {
      console.error('Erro ao atualizar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteCampaign(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await campaignService.deleteCampaign(id);
      res.json({ message: 'Campanha deletada com sucesso' });
    } catch (error: any) {
      console.error('Erro ao deletar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Adiciona destinatários à campanha a partir de uma lista de contatos
   */
  async addRecipients(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { contactIds } = req.body as { contactIds: string[] };

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds é obrigatório e deve conter pelo menos um ID' });
      }

      const campaign = await campaignService.addRecipients(id, contactIds);
      res.json(campaign);
    } catch (error: any) {
      console.error('Erro ao adicionar destinatários à campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Executa uma campanha (envia mensagens para destinatários pendentes)
   */
  async executeCampaign(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;

      const campaign = await campaignService.executeCampaign(id, req.user.id);
      res.json(campaign);
    } catch (error: any) {
      console.error('Erro ao executar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  }
}


