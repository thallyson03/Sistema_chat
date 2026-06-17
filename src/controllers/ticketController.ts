import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TicketService } from '../services/ticketService';
import { Priority, TicketStatus } from '@prisma/client';

const ticketService = new TicketService();

export class TicketController {
  async list(req: AuthRequest, res: Response) {
    try {
      const filters = {
        status: req.query.status as TicketStatus | undefined,
        priority: req.query.priority as Priority | undefined,
        assignedToId: req.query.assignedToId as string | undefined,
        sectorId: req.query.sectorId as string | undefined,
        search: req.query.search as string | undefined,
        conversationId: req.query.conversationId as string | undefined,
      };
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await ticketService.list(filters, limit, offset, req.user);
      res.json(result);
    } catch (error: any) {
      console.error('[TicketController] Erro ao listar tickets:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ticketService.getStats(req.user);
      res.json(stats);
    } catch (error: any) {
      console.error('[TicketController] Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const ticket = await ticketService.getById(req.params.id, req.user);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket não encontrado' });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getByConversationId(req: AuthRequest, res: Response) {
    try {
      const ticket = await ticketService.getByConversationId(req.params.conversationId, req.user);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket não encontrado para esta conversa' });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const ticket = await ticketService.create(req.body, req.user);
      res.status(201).json(ticket);
    } catch (error: any) {
      const status = error.message.includes('Acesso negado') ? 403 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const ticket = await ticketService.update(req.params.id, req.body, req.user);
      res.json(ticket);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async assign(req: AuthRequest, res: Response) {
    try {
      const { assignedToId } = req.body;
      const ticket = await ticketService.assign(req.params.id, assignedToId ?? null, req.user);
      res.json(ticket);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async close(req: AuthRequest, res: Response) {
    try {
      const { resolutionNote } = req.body || {};
      const ticket = await ticketService.close(req.params.id, resolutionNote, req.user);
      res.json(ticket);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async addNote(req: AuthRequest, res: Response) {
    try {
      const { note } = req.body;
      const ticket = await ticketService.addNote(req.params.id, note, req.user);
      res.json(ticket);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async reopen(req: AuthRequest, res: Response) {
    try {
      const ticket = await ticketService.reopen(req.params.id, req.user);
      res.json(ticket);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR')) {
        return res.status(403).json({ error: 'Sem permissão para excluir tickets' });
      }
      const result = await ticketService.delete(req.params.id, req.user);
      res.json(result);
    } catch (error: any) {
      const status = error.message.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  }
}
