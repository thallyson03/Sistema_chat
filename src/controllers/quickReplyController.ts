import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { QuickReplyService } from '../services/quickReplyService';

const quickReplyService = new QuickReplyService();

export class QuickReplyController {
  async create(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { name, shortcut, content, type, mediaUrl, category, isGlobal } = req.body;

      if (!name || !content) {
        return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
      }

      // Apenas admins podem criar respostas globais
      const canCreateGlobal = req.user.role === 'ADMIN' || req.user.role === 'SUPERVISOR';
      const finalIsGlobal = canCreateGlobal && isGlobal ? true : false;

      const quickReply = await quickReplyService.create({
        name,
        shortcut,
        content,
        type,
        mediaUrl,
        category,
        userId: finalIsGlobal ? undefined : req.user.id,
        isGlobal: finalIsGlobal,
      });

      res.status(201).json(quickReply);
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao criar resposta rápida:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      const { name, shortcut, content, type, mediaUrl, category, isGlobal } = req.body;

      // Apenas admins podem tornar respostas globais
      const canMakeGlobal = req.user.role === 'ADMIN' || req.user.role === 'SUPERVISOR';
      const updateData: any = {
        name,
        shortcut,
        content,
        type,
        mediaUrl,
        category,
      };

      if (canMakeGlobal && isGlobal !== undefined) {
        updateData.isGlobal = isGlobal;
      }

      const quickReply = await quickReplyService.update(id, updateData, req.user.id);

      res.json(quickReply);
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao atualizar resposta rápida:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;

      await quickReplyService.delete(id, req.user.id);

      res.json({ message: 'Resposta rápida deletada com sucesso' });
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao deletar resposta rápida:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const quickReply = await quickReplyService.getById(id);

      if (!quickReply) {
        return res.status(404).json({ error: 'Resposta rápida não encontrada' });
      }

      res.json(quickReply);
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao buscar resposta rápida:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const category = req.query.category as string | undefined;

      const quickReplies = await quickReplyService.list(userId, category);

      res.json(quickReplies);
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao listar respostas rápidas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getCategories(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      const categories = await quickReplyService.getCategories(userId);

      res.json(categories);
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao buscar categorias:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async preview(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { contactId, conversationId } = req.query;

      const quickReply = await quickReplyService.getById(id);

      if (!quickReply) {
        return res.status(404).json({ error: 'Resposta rápida não encontrada' });
      }

      // Buscar informações do contato e conversa se fornecidos
      let contact;
      let conversation;

      if (contactId) {
        const prisma = (await import('../config/database')).default;
        contact = await prisma.contact.findUnique({
          where: { id: contactId as string },
          select: { name: true, phone: true, email: true },
        });
      }

      if (conversationId) {
        const prisma = (await import('../config/database')).default;
        conversation = await prisma.conversation.findUnique({
          where: { id: conversationId as string },
          include: {
            channel: {
              select: { name: true },
            },
          },
        });
      }

      // Substituir variáveis
      const previewContent = quickReplyService.replaceVariables(
        quickReply.content,
        contact || undefined,
        conversation || undefined
      );

      res.json({
        ...quickReply,
        previewContent,
      });
    } catch (error: any) {
      console.error('[QuickReplyController] Erro ao gerar preview:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

