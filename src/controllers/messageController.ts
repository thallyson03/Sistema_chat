import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MessageService } from '../services/messageService';

const messageService = new MessageService();

// io será injetado via função (similar ao webhookRoutes)
let io: any = null;

export function setSocketIO(socketIO: any) {
  io = socketIO;
}

export class MessageController {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { conversationId, content, type, mediaUrl, fileName, caption } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversa é obrigatória' });
      }

      // Para mídias, content pode ser vazio (será usado como caption)
      if (!content && !mediaUrl) {
        return res.status(400).json({ error: 'Conteúdo ou mídia são obrigatórios' });
      }

      console.log('[MessageController] Enviando mensagem:', {
        conversationId,
        userId: req.user.id,
        contentLength: content?.length || 0,
        type,
        hasMediaUrl: !!mediaUrl,
        fileName,
      });

      const message = await messageService.sendMessage({
        conversationId,
        userId: req.user.id,
        content: content || caption || '',
        type,
        mediaUrl,
        fileName,
        caption,
      });

      console.log('[MessageController] Mensagem criada com sucesso:', message.id);
      
      // Emitir evento via Socket.IO para atualizar em tempo real
      if (io) {
        try {
          io.emit('new_message', {
            conversationId: conversationId,
            messageId: message.id,
          });
          io.emit('conversation_updated', {
            conversationId: conversationId,
          });
          console.log('[MessageController] 📢 Eventos Socket.IO emitidos para conversa:', conversationId);
        } catch (socketError) {
          console.error('[MessageController] Erro ao emitir evento Socket.IO:', socketError);
        }
      }
      
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



