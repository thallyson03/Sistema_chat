import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ConversationService } from '../services/conversationService';
import { SatisfactionSurveyService } from '../services/satisfactionSurveyService';
import { DashboardPerformanceService } from '../services/dashboardPerformanceService';
import { getSocketIO } from '../routes/webhookRoutes';

const conversationService = new ConversationService();
const satisfactionSurveyService = new SatisfactionSurveyService();
const dashboardPerformanceService = new DashboardPerformanceService();

export class ConversationController {
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const filters = {
        channelId: req.query.channelId as string | undefined,
        assignedToId: req.query.assignedToId as string | undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
        contactId: req.query.contactId as string | undefined,
        inBot:
          typeof req.query.inBot === 'string'
            ? (req.query.inBot as string).toLowerCase() === 'true'
            : undefined,
      };

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      console.log('[ConversationController] Buscando conversas:', {
        filters,
        limit,
        offset,
        userId: req.user?.id,
      });

      const result = await conversationService.getConversations(filters, limit, offset);

      console.log('[ConversationController] Conversas encontradas:', {
        total: result.total,
        count: result.conversations.length,
      });

      res.json(result);
    } catch (error: any) {
      console.error('[ConversationController] Erro ao buscar conversas:', error);
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

  async activateBot(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.activateBotForConversation(id);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Transfere conversa para um setor (fila), opcionalmente redistribuindo
   * automaticamente para um atendente desse setor.
   */
  async transferToSector(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { sectorId, autoAssign, userId } = req.body || {};

      if (!sectorId) {
        return res.status(400).json({ error: 'ID do setor (sectorId) é obrigatório' });
      }

      const conversation = await conversationService.transferToSector(id, sectorId, {
        autoAssign: !!autoAssign,
        userId: typeof userId === 'string' && userId.trim() ? userId.trim() : undefined,
      });

      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Envia pesquisa de satisfação (1–5 estrelas) ao contato no WhatsApp.
   */
  async sendSatisfactionSurvey(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const { id } = req.params;
      const { message } = await satisfactionSurveyService.dispatchSurvey(id, req.user.id);

      const io = getSocketIO();
      if (io) {
        io.to(`conversation_${id}`).emit('new_message', {
          conversationId: id,
          messageId: message.id,
        });
        io.emit('new_message', {
          conversationId: id,
          messageId: message.id,
        });
        io.emit('conversation_updated');
      }

      res.status(201).json({ message });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao enviar pesquisa de satisfação' });
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

  /**
   * Estatísticas da pesquisa de satisfação (1–5) para o dashboard.
   * Query: `days` (1–366, padrão 30).
   */
  async getSatisfactionSurveyStats(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(String(req.query.days || '30'), 10);
      const data = await satisfactionSurveyService.getDashboardStats(days);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar estatísticas da pesquisa' });
    }
  }

  /**
   * Tempo de atendimento (1ª resposta humana, duração até fechamento) e performance por usuário.
   * Query: `days` (1–366, padrão 30).
   */
  async getDashboardPerformance(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(String(req.query.days || '30'), 10);
      const data = await dashboardPerformanceService.getInsights(days);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar performance do dashboard' });
    }
  }

  async createConversation(req: AuthRequest, res: Response) {
    try {
      const { channelId, contactId, assignedToId } = req.body;

      if (!channelId || !contactId) {
        return res.status(400).json({ error: 'channelId e contactId são obrigatórios' });
      }

      const conversation = await conversationService.createConversation({
        channelId,
        contactId,
        assignedToId,
      });

      res.status(201).json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Exclui uma conversa e suas mensagens associadas.
   * Somente ADMIN pode executar.
   */
  async deleteConversation(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem excluir conversas' });
      }

      const { id } = req.params;

      await conversationService.deleteConversation(id);

      res.json({ message: 'Conversa excluída com sucesso' });
    } catch (error: any) {
      console.error('[ConversationController] Erro ao excluir conversa:', error);
      res.status(400).json({ error: error.message });
    }
  }
}







