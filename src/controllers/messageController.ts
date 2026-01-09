import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MessageService } from '../services/messageService';

const messageService = new MessageService();

export class MessageController {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { conversationId, content, type } = req.body;

      if (!conversationId || !content) {
        return res.status(400).json({ error: 'Conversa e conteúdo são obrigatórios' });
      }

      console.log('[MessageController] Enviando mensagem:', {
        conversationId,
        userId: req.user.id,
        contentLength: content.length,
        type,
      });

      const message = await messageService.sendMessage({
        conversationId,
        userId: req.user.id,
        content,
        type,
      });

      console.log('[MessageController] Mensagem criada com sucesso:', message.id);
      res.status(201).json(message);
    } catch (error: any) {
      console.error('[MessageController] Erro ao enviar mensagem:', error.message);
      console.error('[MessageController] Stack:', error.stack?.substring(0, 500));
      res.status(400).json({ error: error.message });
    }
  }

  async getMessages(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await messageService.getMessagesByConversation(
        conversationId,
        limit,
        offset
      );

      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async markAsRead(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { conversationId } = req.params;
      await messageService.markConversationAsRead(conversationId, req.user.id);

      res.json({ message: 'Conversa marcada como lida' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}



