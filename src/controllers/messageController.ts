import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MessageService } from '../services/messageService';
import { ConversationService } from '../services/conversationService';
import { phase1Flags } from '../config/phase1Flags';
import { messageSendQueue } from '../queues/messageSend.queue';
import { idempotencyService } from '../services/idempotencyService';
import crypto from 'crypto';

const messageService = new MessageService();
const conversationService = new ConversationService();

// io será injetado via função (similar ao webhookRoutes)
let io: any = null;

export function setSocketIO(socketIO: any) {
  io = socketIO;
}

export class MessageController {
  private async ensureConversationAccess(req: AuthRequest, res: Response, conversationId: string) {
    if (!req.user) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return false;
    }

    const canAccess = await conversationService.canViewerAccessConversation(conversationId, req.user);
    if (!canAccess) {
      res.status(403).json({ error: 'Acesso negado para esta conversa' });
      return false;
    }
    return true;
  }

  async sendMessage(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { conversationId, content, type, mediaUrl, fileName, caption, mimetype } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversa é obrigatória' });
      }
      if (!(await this.ensureConversationAccess(req, res, conversationId))) {
        return;
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
        mimetype,
      });

      const sendPayload = {
        conversationId,
        userId: req.user.id,
        content: content || caption || '',
        type,
        mediaUrl,
        fileName,
        caption,
        mimetype, // Passar mimetype do arquivo para usar no envio
      };

      if (phase1Flags.messageQueueEnabled) {
        const dedupeKey = crypto
          .createHash('sha256')
          .update(
            JSON.stringify({
              conversationId,
              userId: req.user.id,
              content: sendPayload.content,
              type,
              mediaUrl,
              fileName,
              caption,
            }),
          )
          .digest('hex');

        if (
          phase1Flags.messageIdempotencyEnabled &&
          !idempotencyService.register(`message:${dedupeKey}`, 60_000)
        ) {
          return res.status(202).json({ queued: true, deduped: true });
        }

        await messageSendQueue.enqueue(sendPayload, dedupeKey);
        return res.status(202).json({ queued: true });
      }

      console.log('🚀 [MessageController] Chamando messageService.sendMessage...');
      const message = await messageService.sendMessage(sendPayload);

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
      if (!(await this.ensureConversationAccess(req, res, conversationId))) {
        return;
      }

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

  /** Uma mensagem por id (ex.: atualização em tempo real sem recarregar a lista inteira). */
  async getMessageById(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params;
      const conversationId =
        typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;

      const message = await messageService.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Mensagem não encontrada' });
      }
      if (conversationId && message.conversationId !== conversationId) {
        return res.status(403).json({ error: 'Mensagem não pertence à conversa indicada' });
      }
      if (!(await this.ensureConversationAccess(req, res, conversationId || message.conversationId))) {
        return;
      }

      res.json(message);
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
      if (!(await this.ensureConversationAccess(req, res, conversationId))) {
        return;
      }
      await messageService.markConversationAsRead(conversationId, req.user.id);

      res.json({ message: 'Conversa marcada como lida' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}



