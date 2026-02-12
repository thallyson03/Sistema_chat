import { Request, Response } from 'express';
import { DealService } from '../services/dealService';
import { AuthRequest } from '../middleware/auth';

const dealService = new DealService();

export class DealController {
  async createDeal(req: AuthRequest, res: Response) {
    try {
      console.log('📝 [DealController] Criando novo deal:', {
        body: req.body,
        userId: req.user?.id,
      });
      const deal = await dealService.createDeal(req.body);
      console.log('✅ [DealController] Deal criado com sucesso:', deal.id);
      res.status(201).json(deal);
    } catch (error: any) {
      console.error('❌ [DealController] Erro ao criar deal:', {
        error: error.message,
        stack: error.stack?.substring(0, 500),
      });
      res.status(400).json({ error: error.message });
    }
  }

  async getDeals(req: AuthRequest, res: Response) {
    try {
      const filters = {
        pipelineId: req.query.pipelineId as string | undefined,
        stageId: req.query.stageId as string | undefined,
        contactId: req.query.contactId as string | undefined,
        assignedToId: req.query.assignedToId as string | undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
      };

      const deals = await dealService.getDeals(filters);
      res.json(deals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDealById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const deal = await dealService.getDealById(id);

      if (!deal) {
        return res.status(404).json({ error: 'Negócio não encontrado' });
      }

      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const deal = await dealService.updateDeal(id, req.body);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async moveDealToStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { stageId } = req.body;

      if (!stageId) {
        return res.status(400).json({ error: 'stageId é obrigatório' });
      }

      const deal = await dealService.moveDealToStage(id, stageId);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await dealService.deleteDeal(id);
      res.json({ message: 'Negócio deletado com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // ACTIVITIES
  // ============================================

  async createActivity(req: AuthRequest, res: Response) {
    try {
      const activity = await dealService.createActivity({
        ...req.body,
        userId: req.user?.id,
      });
      res.status(201).json(activity);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getDealActivities(req: AuthRequest, res: Response) {
    try {
      const { dealId } = req.params;
      const activities = await dealService.getDealActivities(dealId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getPipelineStats(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const stats = await dealService.getPipelineStats(pipelineId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async createDealPublic(req: Request, res: Response) {
    try {
      const { pipelineId } = req.params;
      const { stageId, contactId, name, value, customFields, customFieldIds } = req.body;

      // Validar campos obrigatórios
      if (!stageId || !contactId || !name) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: stageId, contactId, name' 
        });
      }

      // Buscar pipeline e validar stage
      const { PipelineService } = await import('../services/pipelineService');
      const pipelineService = new PipelineService();
      const pipeline = await pipelineService.getPipelineById(pipelineId);

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline não encontrado' });
      }

      // Validar se stage pertence ao pipeline
      const stage = pipeline.stages.find((s: any) => s.id === stageId);
      if (!stage) {
        return res.status(400).json({ error: 'Etapa não encontrada no pipeline' });
      }

      // Montar customFields a partir dos IDs fornecidos
      let finalCustomFields: Record<string, any> = {};
      if (customFieldIds && Array.isArray(customFieldIds)) {
        // Se customFieldIds foi fornecido, usar os valores de customFields correspondentes
        if (customFields && typeof customFields === 'object') {
          finalCustomFields = customFields;
        }
      } else if (customFields && typeof customFields === 'object') {
        finalCustomFields = customFields;
      }

      const deal = await dealService.createDeal({
        pipelineId,
        stageId,
        contactId,
        name,
        value,
        customFields: Object.keys(finalCustomFields).length > 0 ? finalCustomFields : undefined,
      });

      res.status(201).json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

