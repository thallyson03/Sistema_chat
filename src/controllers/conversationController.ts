import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ConversationService } from '../services/conversationService';

const conversationService = new ConversationService();

export class ConversationController {
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const filters = {
        channelId: req.query.channelId as string | undefined,
        assignedToId: req.query.assignedToId as string | undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
      };

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await conversationService.getConversations(filters, limit, offset);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getConversationById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.getConversationById(id);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }

      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedToId, status, priority } = req.body;

      const conversation = await conversationService.updateConversation(id, {
        assignedToId,
        status,
        priority,
      });

      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async assignConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório' });
      }

      const conversation = await conversationService.assignConversation(id, userId);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const count = await conversationService.getUnreadCount(userId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await conversationService.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}



