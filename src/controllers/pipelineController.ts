import { Request, Response } from 'express';
import { PipelineService } from '../services/pipelineService';
import { AuthRequest } from '../middleware/auth';

const pipelineService = new PipelineService();

export class PipelineController {
  // ============================================
  // PIPELINES
  // ============================================

  async createPipeline(req: AuthRequest, res: Response) {
    try {
      const pipeline = await pipelineService.createPipeline(req.body);
      res.status(201).json(pipeline);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPipelines(req: AuthRequest, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const pipelines = await pipelineService.getPipelines(includeInactive);
      res.json(pipelines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPipelineById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const pipeline = await pipelineService.getPipelineById(id);

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline não encontrado' });
      }

      res.json(pipeline);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updatePipeline(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const pipeline = await pipelineService.updatePipeline(id, req.body);
      res.json(pipeline);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePipeline(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await pipelineService.deletePipeline(id);
      res.json({ message: 'Pipeline deletado com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // STAGES
  // ============================================

  async createStage(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const stage = await pipelineService.createStage(pipelineId, req.body);
      res.status(201).json(stage);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const stage = await pipelineService.updateStage(id, req.body);
      res.json(stage);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await pipelineService.deleteStage(id);
      res.json({ message: 'Etapa deletada com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async reorderStages(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const { stages } = req.body; // Array de { id, order }

      if (!Array.isArray(stages)) {
        return res.status(400).json({ error: 'stages deve ser um array' });
      }

      const updatedStages = await pipelineService.reorderStages(pipelineId, stages);
      res.json(updatedStages);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}



