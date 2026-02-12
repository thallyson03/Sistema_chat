import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { JourneyService } from '../services/journeyService';
import { JourneyExecutionService } from '../services/journeyExecutionService';

const journeyService = new JourneyService();
const journeyExecutionService = new JourneyExecutionService();

export class JourneyController {
  async createJourney(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nome da jornada é obrigatório' });
      }

      const journey = await journeyService.createJourney({ name, description });
      res.status(201).json(journey);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao criar jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getJourneys(req: AuthRequest, res: Response) {
    try {
      const journeys = await journeyService.getJourneys();
      res.json(journeys);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao listar jornadas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getJourneyById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const journey = await journeyService.getJourneyById(id);

      if (!journey) {
        return res.status(404).json({ error: 'Jornada não encontrada' });
      }

      res.json(journey);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao buscar jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateJourney(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const journey = await journeyService.updateJourney(id, data);
      res.json(journey);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao atualizar jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteJourney(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await journeyService.deleteJourney(id);
      res.json({ message: 'Jornada deletada com sucesso' });
    } catch (error: any) {
      console.error('[JourneyController] Erro ao deletar jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateJourneyGraph(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nodes, edges } = req.body;

      if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        return res.status(400).json({ error: 'nodes e edges são obrigatórios e devem ser arrays' });
      }

      const journey = await journeyService.updateJourneyGraph(id, { nodes, edges });
      res.json(journey);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao atualizar grafo da jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Executa uma jornada para um contato específico (teste manual)
   */
  async executeJourney(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { contactId } = req.body;

      if (!contactId) {
        return res.status(400).json({ error: 'contactId é obrigatório' });
      }

      await journeyExecutionService.executeJourneyForContact(id, contactId);
      res.json({ message: 'Jornada executada com sucesso' });
    } catch (error: any) {
      console.error('[JourneyController] Erro ao executar jornada:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca estatísticas de uma jornada
   */
  async getJourneyStats(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const stats = await journeyService.getJourneyStats(id);
      res.json(stats);
    } catch (error: any) {
      console.error('[JourneyController] Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: error.message });
    }
  }
}


