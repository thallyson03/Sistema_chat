import { Request, Response } from 'express';
import { PipelineCustomFieldService } from '../services/pipelineCustomFieldService';
import { AuthRequest } from '../middleware/auth';

const customFieldService = new PipelineCustomFieldService();

export class PipelineCustomFieldController {
  async createCustomField(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const field = await customFieldService.createCustomField({
        ...req.body,
        pipelineId,
      });
      res.status(201).json(field);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCustomFields(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const fields = await customFieldService.getCustomFields(pipelineId);
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateCustomField(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const field = await customFieldService.updateCustomField(id, req.body);
      res.json(field);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCustomField(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await customFieldService.deleteCustomField(id);
      res.json({ message: 'Campo deletado com sucesso' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async reorderCustomFields(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.params;
      const { fields } = req.body; // Array de { id, order }

      if (!Array.isArray(fields)) {
        return res.status(400).json({ error: 'fields deve ser um array' });
      }

      const updatedFields = await customFieldService.reorderCustomFields(pipelineId, fields);
      res.json(updatedFields);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}



