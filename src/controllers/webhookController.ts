import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WebhookService } from '../services/webhookService';

const webhookService = new WebhookService();

export class WebhookController {
  /**
   * Registra um novo webhook do n8n
   */
  async registerWebhook(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas ADMIN pode registrar webhooks
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem registrar webhooks' });
      }

      const { name, url, events, secret, channelId } = req.body;

      if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          error: 'Nome, URL e eventos são obrigatórios. Eventos deve ser um array não vazio.',
        });
      }

      const webhook = await webhookService.registerWebhook(
        {
          name,
          url,
          events,
          secret,
          channelId,
        },
        req.user.id
      );

      res.status(201).json(webhook);
    } catch (error: any) {
      console.error('[WebhookController] Erro ao registrar webhook:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Lista webhooks configurados
   */
  async listWebhooks(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { channelId, isActive } = req.query;

      const filters: any = {};
      if (channelId) filters.channelId = channelId as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const webhooks = await webhookService.listWebhooks(filters);

      res.json(webhooks);
    } catch (error: any) {
      console.error('[WebhookController] Erro ao listar webhooks:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Atualiza um webhook
   */
  async updateWebhook(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem atualizar webhooks' });
      }

      const { id } = req.params;
      const { name, url, events, secret, channelId, isActive } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (url) updateData.url = url;
      if (events) updateData.events = events;
      if (secret) updateData.secret = secret;
      if (channelId !== undefined) updateData.channelId = channelId;
      if (isActive !== undefined) updateData.isActive = isActive;

      const webhook = await webhookService.updateWebhook(id, updateData);

      res.json(webhook);
    } catch (error: any) {
      console.error('[WebhookController] Erro ao atualizar webhook:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deleta um webhook
   */
  async deleteWebhook(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar webhooks' });
      }

      const { id } = req.params;

      await webhookService.deleteWebhook(id);

      res.json({ message: 'Webhook deletado com sucesso' });
    } catch (error: any) {
      console.error('[WebhookController] Erro ao deletar webhook:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Recebe webhook do n8n (público, mas com autenticação via secret)
   */
  async receiveWebhook(req: Request, res: Response) {
    try {
      const { webhookId, secret } = req.body;

      if (!webhookId || !secret) {
        return res.status(400).json({ error: 'webhookId e secret são obrigatórios' });
      }

      // Validar secret
      const isValid = await webhookService.validateWebhookSecret(webhookId, secret);

      if (!isValid) {
        return res.status(401).json({ error: 'Secret inválido' });
      }

      // Processar comando do n8n
      const { action, data } = req.body;

      switch (action) {
        case 'send_message':
          // Implementar envio de mensagem via MessageService
          res.json({ success: true, message: 'Mensagem enviada (implementar)' });
          break;

        case 'update_conversation':
          // Implementar atualização de conversa
          res.json({ success: true, message: 'Conversa atualizada (implementar)' });
          break;

        default:
          res.status(400).json({ error: `Ação "${action}" não reconhecida` });
      }
    } catch (error: any) {
      console.error('[WebhookController] Erro ao processar webhook do n8n:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtém histórico de execuções de um webhook
   */
  async getWebhookExecutions(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const executions = await webhookService.getWebhookExecutions(id, limit);

      res.json(executions);
    } catch (error: any) {
      console.error('[WebhookController] Erro ao obter execuções:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

