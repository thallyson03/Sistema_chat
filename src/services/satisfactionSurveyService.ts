import prisma from '../config/database';
import evolutionApi from '../config/evolutionApi';
import { getWhatsAppOfficialService } from '../config/whatsappOfficial';
import { WhatsAppOfficialService } from './whatsappOfficialService';
import { WebhookService } from './webhookService';

const webhookService = new WebhookService();

export function parseSatisfactionListReplyId(
  listReplyId: string,
): { dispatchId: string; score: number } | null {
  const raw = String(listReplyId || '').trim();
  if (!raw.startsWith('sat:')) return null;
  const parts = raw.split(':');
  if (parts.length !== 3) return null;
  const [, dispatchId, scoreStr] = parts;
  if (!dispatchId || !/^\d+$/.test(scoreStr)) return null;
  const score = parseInt(scoreStr, 10);
  if (score < 1 || score > 5) return null;
  return { dispatchId, score };
}

function stars(score: number) {
  return '⭐'.repeat(Math.min(5, Math.max(1, score)));
}

export class SatisfactionSurveyService {
  private resolveOfficialService(
    channel: { config: unknown },
    channelConfig: Record<string, unknown>,
  ): WhatsAppOfficialService | null {
    if (
      channelConfig?.provider === 'whatsapp_official' &&
      channelConfig?.phoneNumberId &&
      channelConfig?.businessAccountId &&
      channelConfig?.token
    ) {
      return new WhatsAppOfficialService({
        token: String(channelConfig.token),
        phoneNumberId: String(channelConfig.phoneNumberId),
        businessAccountId: String(channelConfig.businessAccountId),
      });
    }
    if (
      process.env.WHATSAPP_ENV &&
      (process.env.WHATSAPP_ENV === 'dev' || process.env.WHATSAPP_ENV === 'prod')
    ) {
      return getWhatsAppOfficialService();
    }
    return null;
  }

  private shouldUseOfficial(
    channel: { type: string; config: unknown },
    channelConfig: Record<string, unknown>,
    hasPhone: boolean,
  ): boolean {
    if (channel.type !== 'WHATSAPP' || !hasPhone) return false;
    const hasChannel =
      channelConfig?.provider === 'whatsapp_official' &&
      !!channelConfig?.phoneNumberId &&
      !!channelConfig?.businessAccountId &&
      !!channelConfig?.token;
    const hasGlobal =
      !!process.env.WHATSAPP_ENV &&
      (process.env.WHATSAPP_ENV === 'dev' || process.env.WHATSAPP_ENV === 'prod') &&
      getWhatsAppOfficialService() !== null;
    return !!(hasChannel || hasGlobal);
  }

  async dispatchSurvey(conversationId: string, sentByUserId: string) {
    const pending = await prisma.satisfactionSurveyDispatch.findFirst({
      where: { conversationId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new Error('Já existe uma pesquisa de satisfação pendente nesta conversa.');
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { channel: true, contact: true },
    });
    if (!conversation?.channel || !conversation.contact?.phone) {
      throw new Error('Conversa precisa ter canal e telefone do contato para enviar a pesquisa.');
    }

    const channel = conversation.channel;
    const channelConfig = (channel.config || {}) as Record<string, unknown>;

    const dispatch = await prisma.satisfactionSurveyDispatch.create({
      data: {
        conversationId,
        sentByUserId,
        status: 'PENDING',
      },
    });

    const phone = String(conversation.contact.phone).replace(/\D/g, '');
    const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

    let externalId: string | null = null;
    const bodyText =
      'Como você avalia nosso atendimento? Escolha uma nota de 1 a 5 estrelas usando o menu abaixo.';

    let usedOfficial = false;
    try {
      if (this.shouldUseOfficial(channel, channelConfig, true)) {
        const wa = this.resolveOfficialService(channel, channelConfig);
        if (!wa) throw new Error('WhatsApp Official não configurado para este canal.');
        usedOfficial = true;
        const rows = [1, 2, 3, 4, 5].map((n) => ({
          id: `sat:${dispatch.id}:${n}`,
          title: `Nota ${n}/5`,
          description: stars(n),
        }));
        const res = await wa.sendSatisfactionSurveyList({
          to: formattedPhone,
          bodyText,
          rows,
        });
        externalId = res.messageId || null;
      } else if (channel.evolutionInstanceId && channel.evolutionApiKey) {
        const whatsappNumber = `${formattedPhone}@s.whatsapp.net`;
        const text =
          `${bodyText}\n\n` +
          `Responda com *apenas um número* de *1* a *5* (1 = muito insatisfeito, 5 = muito satisfeito).`;
        const evolutionResponse = await evolutionApi.sendMessage(
          channel.evolutionInstanceId,
          whatsappNumber,
          text,
          channel.evolutionApiKey || undefined,
        );
        externalId = evolutionResponse?.key?.id || evolutionResponse?.id || null;
      } else {
        await prisma.satisfactionSurveyDispatch.update({
          where: { id: dispatch.id },
          data: { status: 'EXPIRED' },
        });
        throw new Error('Canal não suporta envio de pesquisa (configure WhatsApp Official ou Evolution).');
      }
    } catch (e: any) {
      await prisma.satisfactionSurveyDispatch.update({
        where: { id: dispatch.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error(e?.message || 'Falha ao enviar pesquisa de satisfação');
    }

    const outboundContent =
      'Pesquisa de satisfação enviada (nota de 1 a 5 estrelas). Aguardando resposta do cliente.';

    const msg = await prisma.message.create({
      data: {
        conversationId,
        userId: sentByUserId,
        content: outboundContent,
        type: 'TEXT',
        status: 'SENT',
        externalId,
        metadata: {
          satisfactionSurveyPrompt: true,
          dispatchId: dispatch.id,
          variant: usedOfficial ? 'interactive_list' : 'text_prompt',
        },
      },
    });

    await prisma.satisfactionSurveyDispatch.update({
      where: { id: dispatch.id },
      data: { promptMessageId: msg.id },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastAgentMessageAt: new Date() },
    });

    return { dispatch, message: msg };
  }

  private async completeSurveyInbound(params: {
    dispatch: { id: string; conversationId: string };
    score: number;
    externalMessageId: string;
    receivedAt: Date;
    assignedToId: string | null;
    contactId: string;
    channelId: string | null;
    provider: 'whatsapp_official' | 'evolution';
  }) {
    const { dispatch, score, externalMessageId, receivedAt, assignedToId, contactId, channelId, provider } =
      params;

    const content = `Nota: ${stars(score)} (${score}/5)`;
    const rec = await prisma.message.create({
      data: {
        conversationId: dispatch.conversationId,
        userId: null,
        content,
        type: 'TEXT',
        status: 'DELIVERED',
        externalId: externalMessageId,
        metadata: {
          satisfactionSurveyResponse: true,
          score,
          dispatchId: dispatch.id,
        },
      },
    });

    await prisma.satisfactionSurveyDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: 'COMPLETED',
        score,
        responseMessageId: rec.id,
      },
    });

    await prisma.conversation.update({
      where: { id: dispatch.conversationId },
      data: {
        lastMessageAt: receivedAt,
        lastCustomerMessageAt: receivedAt,
      },
    });

    if (!assignedToId && channelId) {
      try {
        await webhookService.emitEvent(
          'message.received',
          {
            messageId: rec.id,
            conversationId: dispatch.conversationId,
            contactId,
            channelId,
            content,
            type: 'TEXT',
            fromMe: false,
            metadata: {
              satisfactionSurveyResponse: true,
              score,
              provider,
            },
          },
          channelId,
        );
      } catch {
        // não bloquear fluxo do webhook
      }
    }

    return rec;
  }

  /**
   * WhatsApp Official: resposta via lista interativa (id sat:dispatch:score).
   */
  async handleOfficialListReply(args: {
    conversationId: string;
    listReplyId: string;
    externalMessageId: string;
    receivedAt: Date;
    assignedToId: string | null;
    contactId: string;
    channelId: string | null;
  }): Promise<{ handled: true; messageId: string } | { handled: false }> {
    const parsed = parseSatisfactionListReplyId(args.listReplyId);
    if (!parsed) return { handled: false };

    const dispatch = await prisma.satisfactionSurveyDispatch.findFirst({
      where: {
        id: parsed.dispatchId,
        conversationId: args.conversationId,
        status: 'PENDING',
      },
    });
    if (!dispatch) return { handled: false };

    const rec = await this.completeSurveyInbound({
      dispatch: { id: dispatch.id, conversationId: dispatch.conversationId },
      score: parsed.score,
      externalMessageId: args.externalMessageId,
      receivedAt: args.receivedAt,
      assignedToId: args.assignedToId,
      contactId: args.contactId,
      channelId: args.channelId,
      provider: 'whatsapp_official',
    });

    return { handled: true, messageId: rec.id };
  }

  /**
   * Texto "1".."5" quando existe pesquisa pendente (Evolution ou fallback Official).
   */
  async tryConsumeTextSurveyReply(args: {
    conversationId: string;
    score: number;
    externalMessageId: string;
    receivedAt: Date;
    assignedToId: string | null;
    contactId: string;
    channelId: string | null;
    provider: 'whatsapp_official' | 'evolution';
  }): Promise<{ handled: true; messageId: string } | { handled: false }> {
    if (args.score < 1 || args.score > 5) return { handled: false };

    const dispatch = await prisma.satisfactionSurveyDispatch.findFirst({
      where: { conversationId: args.conversationId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!dispatch) return { handled: false };

    const rec = await this.completeSurveyInbound({
      dispatch: { id: dispatch.id, conversationId: dispatch.conversationId },
      score: args.score,
      externalMessageId: args.externalMessageId,
      receivedAt: args.receivedAt,
      assignedToId: args.assignedToId,
      contactId: args.contactId,
      channelId: args.channelId,
      provider: args.provider,
    });

    return { handled: true, messageId: rec.id };
  }

  /**
   * Métricas agregadas e últimas respostas para o dashboard.
   */
  async getDashboardStats(rawDays: number, viewer?: { id: string; role: string }) {
    const days = Math.min(Math.max(Math.floor(Number(rawDays)) || 30, 1), 366);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const isAdmin = viewer?.role === 'ADMIN';
    const ownScope =
      !isAdmin && viewer?.id
        ? { sentByUserId: viewer.id }
        : !isAdmin
          ? { sentByUserId: '__no_access__' }
          : {};

    const [sentInPeriod, pendingTotal, distributionRows, recentRows] = await Promise.all([
      prisma.satisfactionSurveyDispatch.count({
        where: { ...ownScope, createdAt: { gte: start } },
      }),
      prisma.satisfactionSurveyDispatch.count({
        where: { ...ownScope, status: 'PENDING' },
      }),
      prisma.satisfactionSurveyDispatch.groupBy({
        by: ['score'],
        where: {
          ...ownScope,
          status: 'COMPLETED',
          score: { not: null },
          updatedAt: { gte: start },
        },
        _count: { id: true },
      }),
      prisma.satisfactionSurveyDispatch.findMany({
        where: { ...ownScope, status: 'COMPLETED', score: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          conversation: {
            select: {
              id: true,
              contact: { select: { name: true, phone: true } },
              channel: { select: { name: true } },
            },
          },
          sentBy: { select: { name: true } },
        },
      }),
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let completedInPeriod = 0;
    let weighted = 0;
    for (const row of distributionRows) {
      const s = row.score;
      if (s === null || s < 1 || s > 5) continue;
      const c = row._count.id;
      distribution[s] = c;
      completedInPeriod += c;
      weighted += s * c;
    }

    const averageScore =
      completedInPeriod > 0 ? Math.round((weighted / completedInPeriod) * 10) / 10 : null;

    const responseRatePercent =
      sentInPeriod > 0 ? Math.round((completedInPeriod / sentInPeriod) * 1000) / 10 : null;

    const recent = recentRows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      score: r.score as number,
      respondedAt: r.updatedAt.toISOString(),
      contactName: r.conversation?.contact?.name ?? null,
      contactPhone: r.conversation?.contact?.phone ?? null,
      channelName: r.conversation?.channel?.name ?? null,
      sentByName: r.sentBy?.name ?? null,
    }));

    return {
      periodDays: days,
      periodStart: start.toISOString(),
      summary: {
        sentInPeriod,
        completedInPeriod,
        pendingTotal,
        averageScore,
        distribution,
        responseRatePercent,
      },
      recent,
    };
  }
}
