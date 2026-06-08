import { Request, Response } from 'express';
import { DealService } from '../services/dealService';
import { AuthRequest } from '../middleware/auth';
import { canAccessPipeline, getUserPipelineIds } from '../utils/accessControl';
import prisma from '../config/database';

const dealService = new DealService();

export class DealController {
  private async ensureDealAccess(req: AuthRequest, res: Response, dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { pipelineId: true },
    });
    if (!deal) {
      res.status(404).json({ error: 'Negócio não encontrado' });
      return null;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return null;
    }
    const allowed = await canAccessPipeline(req.user, deal.pipelineId);
    if (!allowed) {
      res.status(403).json({ error: 'Acesso negado para este negócio' });
      return null;
    }
    return deal;
  }

  private async ensurePipelineBodyAccess(req: AuthRequest, res: Response, pipelineId?: string) {
    if (!pipelineId || !req.user) {
      res.status(400).json({ error: 'pipelineId é obrigatório' });
      return false;
    }
    const allowed = await canAccessPipeline(req.user, pipelineId);
    if (!allowed) {
      res.status(403).json({ error: 'Acesso negado para este pipeline' });
      return false;
    }
    return true;
  }

  async createDeal(req: AuthRequest, res: Response) {
    try {
      const allowed = await this.ensurePipelineBodyAccess(req, res, req.body?.pipelineId);
      if (!allowed) return;

      const deal = await dealService.createDeal(req.body);
      res.status(201).json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getDeals(req: AuthRequest, res: Response) {
    try {
      const allowedPipelineIds = req.user
        ? await getUserPipelineIds(req.user)
        : [];

      const filters = {
        pipelineId: req.query.pipelineId as string | undefined,
        stageId: req.query.stageId as string | undefined,
        contactId: req.query.contactId as string | undefined,
        assignedToId: req.query.assignedToId as string | undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
      };

      const deals = await dealService.getDeals(filters, allowedPipelineIds);
      res.json(deals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDealById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

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
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

      const deal = await dealService.updateDeal(id, req.body);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async moveDealToStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

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

  async addTagToDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

      const deal = await dealService.addTagToDeal(id, req.body.tagId);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async removeTagFromDeal(req: AuthRequest, res: Response) {
    try {
      const { id, tagId } = req.params;
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

      const deal = await dealService.removeTagFromDeal(id, tagId);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const access = await this.ensureDealAccess(req, res, id);
      if (!access) return;

      if (req.user?.role === 'AGENT') {
        return res.status(403).json({ error: 'Agentes não podem excluir negócios' });
      }

      await dealService.deleteDeal(id);
      res.json({ message: 'Negócio excluído com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async createActivity(req: AuthRequest, res: Response) {
    try {
      const { dealId } = req.params;
      const access = await this.ensureDealAccess(req, res, dealId);
      if (!access) return;

      const activity = await dealService.createActivity({
        ...req.body,
        dealId,
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
      const access = await this.ensureDealAccess(req, res, dealId);
      if (!access) return;

      const activities = await dealService.getDealActivities(dealId);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updatePipelineTask(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await prisma.pipelineTask.findUnique({
        where: { id: taskId },
        include: { deal: { select: { id: true, pipelineId: true } } },
      });
      if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
      const access = await this.ensureDealAccess(req, res, task.deal.id);
      if (!access) return;

      const updated = await dealService.updatePipelineTask(taskId, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePipelineTaskByDealAndTitle(req: AuthRequest, res: Response) {
    try {
      const { dealId } = req.params;
      const access = await this.ensureDealAccess(req, res, dealId);
      if (!access) return;

      const updated = await dealService.updatePipelineTaskByDealAndTitle(
        dealId,
        req.body.title,
        req.body,
      );
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPipelineStats(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
      const allowed = await canAccessPipeline(req.user, pipelineId);
      if (!allowed) return res.status(403).json({ error: 'Acesso negado' });

      const stats = await dealService.getPipelineStats(pipelineId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCalendarTasks(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

      const start = new Date(String(req.query.start));
      const end = new Date(String(req.query.end));

      const tasks = await dealService.getCalendarTasks({
        start,
        end,
        userId: req.user.id,
        role: req.user.role,
        includeNoDue: req.query.includeNoDue === 'true',
      });
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createDealPublic(req: Request, res: Response) {
    try {
      const deal = await dealService.createDeal(req.body);
      res.status(201).json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
