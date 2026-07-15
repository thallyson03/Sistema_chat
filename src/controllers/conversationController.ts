import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { getBaileysApi, resolveBaileysApiKey } from '../utils/channelWhatsAppProvider';
import { ConversationService } from '../services/conversationService';
import { SatisfactionSurveyService } from '../services/satisfactionSurveyService';
import { DashboardPerformanceService } from '../services/dashboardPerformanceService';
import { metaDeliveryMetricsService } from '../services/metaDeliveryMetricsService';
import { hybridCacheService } from '../services/hybridCacheService';
import { getSocketIO } from '../routes/webhookRoutes';
import { emitConversationDelta } from '../utils/realtimeEvents';
import { parseDashboardDates, parseOptionalId } from '../utils/dashboardDateFilter';

const conversationService = new ConversationService();
const satisfactionSurveyService = new SatisfactionSurveyService();
const dashboardPerformanceService = new DashboardPerformanceService();

export class ConversationController {
  private getConversationsListTtlMs() {
    return Math.max(
      1000,
      Number(process.env.CONVERSATIONS_LIST_CACHE_TTL_MS) || 3000,
    );
  }

  private getMetricsTtlMs() {
    return Math.max(
      1000,
      Number(process.env.DASHBOARD_CACHE_TTL_MS) || 15_000,
    );
  }

  private parseDashboardQueryFilters(req: AuthRequest) {
    return {
      channelId: parseOptionalId(req.query.channelId),
      sectorId: parseOptionalId(req.query.sectorId),
      assignedToId: parseOptionalId(req.query.assignedToId),
      dates: parseDashboardDates(req.query.dates),
    };
  }

  private buildMetricsCacheKey(prefix: string, req: AuthRequest): string {
    const qp = new URLSearchParams();
    Object.entries(req.query || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => qp.append(k, String(item)));
      } else if (v !== undefined) {
        qp.append(k, String(v));
      }
    });
    return [
      prefix,
      req.user?.id || 'anon',
      req.user?.role || 'none',
      qp.toString(),
    ].join(':');
  }

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
      const cacheKey = this.buildMetricsCacheKey('conversation:list', req);
      const result = await hybridCacheService.getOrSet(
        cacheKey,
        this.getConversationsListTtlMs(),
        () => conversationService.getConversations(filters, limit, offset, req.user),
      );

      res.json(result);
    } catch (error: any) {
      console.error('[ConversationController] Erro ao buscar conversas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getConversationById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const conversation = await conversationService.getConversationById(id, req.user);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }

      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Evolution/Baileys: inscreve presença do contato para receber digitando/gravando via webhook. */
  async subscribeContactPresence(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          contact: { select: { id: true, phone: true } },
          channel: {
            select: {
              id: true,
              type: true,
              config: true,
              evolutionInstanceId: true,
              evolutionApiKey: true,
            },
          },
        },
      });

      if (!conversation?.channel?.evolutionInstanceId || !conversation.contact?.phone) {
        return res.json({ ok: false, skipped: true });
      }

      const { contactResolutionService } = await import('../services/contactResolutionService');

      const recentMessages = await prisma.message.findMany({
        where: { conversationId: id },
        select: { metadata: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      for (const row of recentMessages) {
        const key = (row.metadata as { key?: Record<string, string> } | null)?.key;
        for (const candidate of [key?.remoteJidAlt, key?.participant, key?.remoteJid]) {
          if (candidate?.includes('@lid')) {
            await contactResolutionService.upsertLidIdentity({
              contactId: conversation.contact.id,
              channelId: conversation.channel.id,
              lidJid: candidate,
            });
          }
        }
      }

      const baileysApi = getBaileysApi(conversation.channel);
      const apiKey = resolveBaileysApiKey(conversation.channel);

      const waInfo = await Promise.race([
        baileysApi.fetchWhatsAppNumberInfo(
          conversation.channel.evolutionInstanceId,
          conversation.contact.phone,
          apiKey,
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
      ]);
      const lidFromApi =
        typeof waInfo?.lid === 'string' && waInfo.lid !== 'lid'
          ? waInfo.lid.includes('@')
            ? waInfo.lid
            : `${waInfo.lid}@lid`
          : typeof waInfo?.jid === 'string' && waInfo.jid.includes('@lid')
            ? waInfo.jid
            : null;
      if (lidFromApi) {
        await contactResolutionService.upsertLidIdentity({
          contactId: conversation.contact.id,
          channelId: conversation.channel.id,
          lidJid: lidFromApi,
        });
      }

      await baileysApi.subscribeContactPresence(
        conversation.channel.evolutionInstanceId,
        conversation.contact.phone,
        apiKey,
      );

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Evolution: exibe digitando/gravando no WhatsApp do destinatário enquanto o atendente compõe no CRM. */
  async sendOutboundPresence(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { state } = req.body || {};
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }

      const allowed = ['composing', 'recording', 'paused'] as const;
      if (!allowed.includes(state)) {
        return res.status(400).json({
          error: 'state deve ser composing, recording ou paused',
        });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          contact: { select: { phone: true } },
          channel: {
            select: {
              config: true,
              evolutionInstanceId: true,
              evolutionApiKey: true,
            },
          },
        },
      });

      if (!conversation?.channel?.evolutionInstanceId || !conversation.contact?.phone) {
        return res.json({ ok: false, skipped: true });
      }

      const instanceId = conversation.channel.evolutionInstanceId;
      const phone = conversation.contact.phone;
      const baileysApi = getBaileysApi(conversation.channel);
      const apiKey = resolveBaileysApiKey(conversation.channel);

      await baileysApi.sendOutboundPresence(instanceId, phone, state, apiKey);

      // composing/recording de saída pode cancelar a inscrição inbound no Baileys — reativar.
      await baileysApi.subscribeContactPresence(instanceId, phone, apiKey);

      res.json({ ok: true, state });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { assignedToId, status, priority } = req.body;
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }

      const validateSector = req.user?.role !== 'ADMIN';
      const conversation = await conversationService.updateConversation(
        id,
        {
          assignedToId,
          status,
          priority,
        },
        validateSector,
      );

      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async assignConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }

      if (!userId) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório' });
      }

      const validateSector = req.user?.role !== 'ADMIN';
      const conversation = await conversationService.assignConversation(
        id,
        userId,
        validateSector,
      );
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async activateBot(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }
      const conversation = await conversationService.activateBotForConversation(id);
      if (!conversation) {
        return res.status(400).json({
          error:
            'Nenhum bot ativo configurado para este canal/setor. Publique um bot no canal Evo antes de ativar.',
        });
      }
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
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }

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
      if (!(await this.ensureConversationAccess(req, res, id))) {
        return;
      }
      const { message } = await satisfactionSurveyService.dispatchSurvey(id, req.user.id);

      const io = getSocketIO();
      if (io) {
        emitConversationDelta(io, 'new_message', {
          conversationId: id,
          messageId: message.id,
        });
        emitConversationDelta(io, 'conversation_updated', { conversationId: id });
      }

      res.status(201).json({ message });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao enviar pesquisa de satisfação' });
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const cacheKey = this.buildMetricsCacheKey('conversation:unread-count', req);
      const count = await hybridCacheService.getOrSet(
        cacheKey,
        this.getMetricsTtlMs(),
        () => conversationService.getUnreadCount(userId, req.user),
      );
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const cacheKey = this.buildMetricsCacheKey('conversation:stats', req);
      const stats = await hybridCacheService.getOrSet(
        cacheKey,
        this.getMetricsTtlMs(),
        () => conversationService.getStats(req.user),
      );
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Métricas de conversas (abertas, fechadas, fila, bot) com filtros opcionais.
   * Query: `days` (0 ou omitido = sem filtro de criação), `channelId`, `sectorId`.
   */
  async getDashboardConversationMetrics(req: AuthRequest, res: Response) {
    try {
      const cacheKey = this.buildMetricsCacheKey('conversation:metrics', req);
      const daysRaw = req.query.days;
      let days: number | undefined;
      if (daysRaw !== undefined && daysRaw !== '') {
        const n = parseInt(String(daysRaw), 10);
        if (Number.isFinite(n) && n >= 0) {
          days = n;
        }
      }
      const channelId = typeof req.query.channelId === 'string' ? req.query.channelId.trim() || undefined : undefined;
      const sectorId = typeof req.query.sectorId === 'string' ? req.query.sectorId.trim() || undefined : undefined;
      const { assignedToId, dates } = this.parseDashboardQueryFilters(req);
      const data = await hybridCacheService.getOrSet(
        cacheKey,
        this.getMetricsTtlMs(),
        () =>
          conversationService.getDashboardConversationMetrics(req.user, {
            days,
            channelId,
            sectorId,
            assignedToId,
            dates,
          }),
      );
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar métricas de conversas' });
    }
  }

  /**
   * Estatísticas da pesquisa de satisfação (1–5) para o dashboard.
   * Query: `days` (1–366, padrão 30).
   */
  async getSatisfactionSurveyStats(req: AuthRequest, res: Response) {
    try {
      const cacheKey = this.buildMetricsCacheKey('conversation:satisfaction', req);
      const days = parseInt(String(req.query.days || '30'), 10);
      const channelId = typeof req.query.channelId === 'string' ? req.query.channelId.trim() || undefined : undefined;
      const sectorId = typeof req.query.sectorId === 'string' ? req.query.sectorId.trim() || undefined : undefined;
      const { assignedToId, dates } = this.parseDashboardQueryFilters(req);
      const data = await hybridCacheService.getOrSet(
        cacheKey,
        this.getMetricsTtlMs(),
        () =>
          satisfactionSurveyService.getDashboardStats(days, req.user, {
            channelId,
            sectorId,
            assignedToId,
            dates,
          }),
      );
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
      const cacheKey = this.buildMetricsCacheKey('conversation:performance', req);
      const days = parseInt(String(req.query.days || '30'), 10);
      const channelId = typeof req.query.channelId === 'string' ? req.query.channelId.trim() || undefined : undefined;
      const sectorId = typeof req.query.sectorId === 'string' ? req.query.sectorId.trim() || undefined : undefined;
      const { assignedToId, dates } = this.parseDashboardQueryFilters(req);
      const data = await hybridCacheService.getOrSet(
        cacheKey,
        this.getMetricsTtlMs(),
        () =>
          dashboardPerformanceService.getInsights(days, req.user, {
            channelId,
            sectorId,
            assignedToId,
            dates,
          }),
      );
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar performance do dashboard' });
    }
  }

  /**
   * Métricas híbridas WhatsApp Official por canal/número:
   * - internas (Message.status via webhook)
   * - Insights Meta (WABA analytics / conversation_analytics)
   * Query: `days` (1–366), `channelId`, `sectorId`.
   */
  async getDashboardMetaDeliveryMetrics(req: AuthRequest, res: Response) {
    try {
      const cacheKey = this.buildMetricsCacheKey('conversation:meta-delivery', req);
      const days = parseInt(String(req.query.days || '30'), 10);
      const channelId =
        typeof req.query.channelId === 'string' ? req.query.channelId.trim() || undefined : undefined;
      const sectorId =
        typeof req.query.sectorId === 'string' ? req.query.sectorId.trim() || undefined : undefined;
      const { assignedToId, dates } = this.parseDashboardQueryFilters(req);
      const ttlMs = Math.max(
        this.getMetricsTtlMs(),
        Number(process.env.META_DELIVERY_METRICS_CACHE_TTL_MS) || 120_000,
      );
      const data = await hybridCacheService.getOrSet(cacheKey, ttlMs, () =>
        metaDeliveryMetricsService.getHybridMetrics(days, req.user, {
          channelId,
          sectorId,
          assignedToId,
          dates,
        }),
      );
      res.json(data);
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Erro ao carregar métricas de entrega WhatsApp/Meta',
      });
    }
  }

  async createConversation(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { channelId, contactId, assignedToId } = req.body;

      if (!channelId || !contactId) {
        return res.status(400).json({ error: 'channelId e contactId são obrigatórios' });
      }

      const { canUserAccessChannel } = await import('../utils/channelAccess');
      const { buildContactVisibilityWhere } = await import('../utils/accessControl');
      const canUseChannel = await canUserAccessChannel(req.user, channelId);
      if (!canUseChannel) {
        return res.status(403).json({ error: 'Sem permissão para usar este canal' });
      }

      const visibilityWhere = await buildContactVisibilityWhere(req.user);
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ...visibilityWhere },
      });
      if (!contact) {
        return res.status(403).json({ error: 'Sem permissão para acessar este contato' });
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

      const { auditLogService } = await import('../services/auditLogService');
      await auditLogService.log({
        userId: req.user.id,
        action: 'DELETE_CONVERSATION',
        resource: 'conversation',
        resourceId: id,
      });

      res.json({ message: 'Conversa excluída com sucesso' });
    } catch (error: any) {
      console.error('[ConversationController] Erro ao excluir conversa:', error);
      res.status(400).json({ error: error.message });
    }
  }
}







