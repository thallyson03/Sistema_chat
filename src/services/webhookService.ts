import prisma from '../config/database';
import axios from 'axios';
import crypto from 'crypto';

export interface RegisterWebhookData {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  channelId?: string;
}

export interface WebhookFilters {
  channelId?: string;
  isActive?: boolean;
}

export class WebhookService {
  /**
   * Registra um novo webhook do n8n
   */
  async registerWebhook(data: RegisterWebhookData, userId: string) {
    // Gerar secret se não fornecido
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhookConfig.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        secret: secret,
        channelId: data.channelId,
        isActive: true,
      },
    });

    console.log('[WebhookService] Webhook registrado:', {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
    });

    return webhook;
  }

  /**
   * Lista webhooks configurados
   */
  async listWebhooks(filters?: WebhookFilters) {
    const where: any = {};

    if (filters?.channelId) {
      where.channelId = filters.channelId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const webhooks = await prisma.webhookConfig.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return webhooks;
  }

  /**
   * Atualiza um webhook
   */
  async updateWebhook(webhookId: string, data: Partial<RegisterWebhookData>) {
    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.url) updateData.url = data.url;
    if (data.events) updateData.events = data.events;
    if (data.secret) updateData.secret = data.secret;
    if (data.channelId !== undefined) updateData.channelId = data.channelId;

    const webhook = await prisma.webhookConfig.update({
      where: { id: webhookId },
      data: updateData,
    });

    console.log('[WebhookService] Webhook atualizado:', webhookId);

    return webhook;
  }

  /**
   * Deleta um webhook
   */
  async deleteWebhook(webhookId: string) {
    await prisma.webhookConfig.delete({
      where: { id: webhookId },
    });

    console.log('[WebhookService] Webhook deletado:', webhookId);
  }

  /**
   * Emite um evento para todos os webhooks configurados
   */
  async emitEvent(event: string, data: any, channelId?: string) {
    const where: any = {
      isActive: true,
      events: {
        has: event, // Verifica se o evento está na lista de eventos do webhook
      },
    };

    if (channelId) {
      where.OR = [
        { channelId: channelId },
        { channelId: null }, // Webhooks globais (sem canal específico)
      ];
    } else {
      where.channelId = null; // Apenas webhooks globais
    }

    const webhooks = await prisma.webhookConfig.findMany({
      where,
    });

    console.log(`[WebhookService] Emitindo evento "${event}" para ${webhooks.length} webhook(s)`);

    const promises = webhooks.map(async (webhook) => {
      try {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          data,
        };

        const response = await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret || '',
          },
          timeout: 5000, // 5 segundos
        });

        // Registrar execução bem-sucedida
        await prisma.webhookExecution.create({
          data: {
            webhookId: webhook.id,
            event,
            status: 'SUCCESS',
            requestBody: payload,
            responseBody: response.data,
          },
        });

        console.log(`[WebhookService] ✅ Evento "${event}" enviado para ${webhook.name}`);
        return { webhookId: webhook.id, status: 'SUCCESS' };
      } catch (error: any) {
        // Registrar execução com falha
        await prisma.webhookExecution.create({
          data: {
            webhookId: webhook.id,
            event,
            status: 'FAILED',
            requestBody: { event, data },
            error: error.message || 'Erro desconhecido',
          },
        });

        console.error(`[WebhookService] ❌ Erro ao enviar evento "${event}" para ${webhook.name}:`, error.message);
        return { webhookId: webhook.id, status: 'FAILED', error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    return results;
  }

  /**
   * Valida o secret de um webhook recebido
   */
  async validateWebhookSecret(webhookId: string, secret: string): Promise<boolean> {
    const webhook = await prisma.webhookConfig.findUnique({
      where: { id: webhookId },
      select: { secret: true },
    });

    if (!webhook) {
      return false;
    }

    return webhook.secret === secret;
  }

  /**
   * Obtém histórico de execuções de um webhook
   */
  async getWebhookExecutions(webhookId: string, limit: number = 50) {
    const executions = await prisma.webhookExecution.findMany({
      where: { webhookId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });

    return executions;
  }
}


