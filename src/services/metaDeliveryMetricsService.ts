import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { decryptConfigSecrets, decryptField } from '../utils/fieldEncryption';
import { buildChannelVisibilityWhere } from '../utils/channelAccess';
import { AccessViewer } from '../utils/accessControl';
import { WhatsAppOfficialService } from './whatsappOfficialService';
import {
  buildSqlDateOr,
  continuousWindowFromDates,
  startDateFromDays,
} from '../utils/dashboardDateFilter';

type InternalStatusCounts = {
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  outboundTotal: number;
  deliveryRatePercent: number | null;
  readRatePercent: number | null;
  failureRatePercent: number | null;
};

type MetaInsightsBlock = {
  available: boolean;
  error: string | null;
  displayPhoneNumber: string | null;
  sent: number | null;
  delivered: number | null;
  deliveryRatePercent: number | null;
  conversations: number | null;
  conversationCost: number | null;
};

export type ChannelDeliveryMetrics = {
  channelId: string;
  channelName: string;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  internal: InternalStatusCounts;
  meta: MetaInsightsBlock;
};

function rate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyInternal(): InternalStatusCounts {
  return {
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    outboundTotal: 0,
    deliveryRatePercent: null,
    readRatePercent: null,
    failureRatePercent: null,
  };
}

function buildInternalFromRows(
  rows: Array<{ status: string; count: number }>,
): InternalStatusCounts {
  const counts = emptyInternal();
  for (const row of rows) {
    const n = Number(row.count) || 0;
    switch (String(row.status).toUpperCase()) {
      case 'PENDING':
        counts.pending += n;
        break;
      case 'SENT':
        counts.sent += n;
        break;
      case 'DELIVERED':
        counts.delivered += n;
        break;
      case 'READ':
        counts.read += n;
        break;
      case 'FAILED':
        counts.failed += n;
        break;
      default:
        break;
    }
  }

  // Status é estado final: delivered+read já passaram por “enviado”.
  const acceptedOrBeyond = counts.sent + counts.delivered + counts.read;
  const deliveredOrBeyond = counts.delivered + counts.read;
  counts.outboundTotal =
    counts.pending + counts.sent + counts.delivered + counts.read + counts.failed;
  counts.deliveryRatePercent = rate(deliveredOrBeyond, acceptedOrBeyond + counts.failed);
  counts.readRatePercent = rate(counts.read, deliveredOrBeyond || acceptedOrBeyond);
  counts.failureRatePercent = rate(counts.failed, counts.outboundTotal);
  return counts;
}

export class MetaDeliveryMetricsService {
  async getHybridMetrics(
    days: number,
    viewer?: AccessViewer,
    filters?: {
      channelId?: string;
      sectorId?: string;
      assignedToId?: string;
      dates?: string[];
    },
  ) {
    const selectedDates = Array.isArray(filters?.dates) ? filters!.dates! : [];
    const periodDays = Math.min(Math.max(Math.floor(days) || 30, 1), 366);
    const continuous = continuousWindowFromDates(selectedDates);
    const periodStart = continuous?.start ?? startDateFromDays(periodDays);
    const periodEnd = continuous?.end ?? new Date();
    const startUnix = Math.floor(periodStart.getTime() / 1000);
    const endUnix = Math.floor(periodEnd.getTime() / 1000);

    const visibilityWhere = viewer ? await buildChannelVisibilityWhere(viewer) : {};
    const channels = await prisma.channel.findMany({
      where: {
        AND: [
          visibilityWhere,
          { type: 'WHATSAPP' },
          ...(filters?.channelId ? [{ id: filters.channelId }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        config: true,
      },
      orderBy: { name: 'asc' },
    });

    const officialChannels = channels.filter((ch) => {
      const cfg = (ch.config || {}) as Record<string, unknown>;
      return String(cfg.provider || '').toLowerCase() === 'whatsapp_official';
    });

    const channelMetrics: ChannelDeliveryMetrics[] = await Promise.all(
      officialChannels.map(async (channel) => {
        const decrypted = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
        const phoneNumberId = String(decrypted.phoneNumberId || '').trim() || null;
        const businessAccountId = String(decrypted.businessAccountId || '').trim() || null;
        const token =
          decryptField(String(decrypted.token || ''))?.trim() ||
          String(decrypted.token || '').trim() ||
          '';

        const internal = await this.aggregateInternalForChannel(
          channel.id,
          periodStart,
          selectedDates,
          filters?.sectorId,
          filters?.assignedToId,
        );
        const meta = await this.fetchMetaInsightsForChannel({
          token,
          phoneNumberId,
          businessAccountId,
          startUnix,
          endUnix,
        });

        return {
          channelId: channel.id,
          channelName: channel.name,
          phoneNumberId,
          businessAccountId,
          internal,
          meta,
        };
      }),
    );

    const totalsInternal = channelMetrics.reduce((acc, item) => {
      acc.pending += item.internal.pending;
      acc.sent += item.internal.sent;
      acc.delivered += item.internal.delivered;
      acc.read += item.internal.read;
      acc.failed += item.internal.failed;
      acc.outboundTotal += item.internal.outboundTotal;
      return acc;
    }, emptyInternal());

    const acceptedOrBeyond =
      totalsInternal.sent + totalsInternal.delivered + totalsInternal.read;
    const deliveredOrBeyond = totalsInternal.delivered + totalsInternal.read;
    totalsInternal.deliveryRatePercent = rate(
      deliveredOrBeyond,
      acceptedOrBeyond + totalsInternal.failed,
    );
    totalsInternal.readRatePercent = rate(
      totalsInternal.read,
      deliveredOrBeyond || acceptedOrBeyond,
    );
    totalsInternal.failureRatePercent = rate(totalsInternal.failed, totalsInternal.outboundTotal);

    let metaSent = 0;
    let metaDelivered = 0;
    let metaConversations = 0;
    let metaCost = 0;
    let metaAvailableCount = 0;
    let hasMetaCost = false;
    for (const item of channelMetrics) {
      if (!item.meta.available) continue;
      metaAvailableCount += 1;
      metaSent += item.meta.sent || 0;
      metaDelivered += item.meta.delivered || 0;
      metaConversations += item.meta.conversations || 0;
      if (item.meta.conversationCost != null) {
        hasMetaCost = true;
        metaCost += item.meta.conversationCost;
      }
    }

    return {
      periodDays: selectedDates.length || periodDays,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      selectedDates: selectedDates.length ? selectedDates : null,
      sources: {
        internal: 'Message.status via webhook Meta (outbound CRM)',
        meta: 'Graph WABA analytics + conversation_analytics',
      },
      channels: channelMetrics,
      totals: {
        internal: totalsInternal,
        meta: {
          channelsWithInsights: metaAvailableCount,
          sent: metaAvailableCount ? metaSent : null,
          delivered: metaAvailableCount ? metaDelivered : null,
          deliveryRatePercent: metaAvailableCount
            ? rate(metaDelivered, metaSent)
            : null,
          conversations: metaAvailableCount ? metaConversations : null,
          conversationCost: hasMetaCost ? metaCost : null,
        },
      },
      filters: {
        channelId: filters?.channelId ?? null,
        sectorId: filters?.sectorId ?? null,
        assignedToId: filters?.assignedToId ?? null,
        dates: selectedDates.length ? selectedDates : null,
      },
    };
  }

  private async aggregateInternalForChannel(
    channelId: string,
    periodStart: Date,
    selectedDates: string[],
    sectorId?: string,
    assignedToId?: string,
  ): Promise<InternalStatusCounts> {
    const sectorClause = sectorId
      ? Prisma.sql`AND c."sectorId" = ${sectorId}`
      : Prisma.empty;
    const assigneeClause = assignedToId
      ? Prisma.sql`AND c."assignedToId" = ${assignedToId}`
      : Prisma.empty;
    const dateClause = selectedDates.length
      ? buildSqlDateOr('m."createdAt"', selectedDates)
      : Prisma.sql`AND m."createdAt" >= ${periodStart}`;

    const rows = await prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT m.status::text AS status, COUNT(*)::int AS count
      FROM "Message" m
      INNER JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."channelId" = ${channelId}
        ${dateClause}
        ${sectorClause}
        ${assigneeClause}
        AND (
          m."userId" IS NOT NULL
          OR (
            m.metadata IS NOT NULL
            AND (m.metadata::jsonb ->> 'fromBot') = 'true'
          )
        )
      GROUP BY m.status
    `;

    return buildInternalFromRows(rows);
  }

  private async fetchMetaInsightsForChannel(params: {
    token: string;
    phoneNumberId: string | null;
    businessAccountId: string | null;
    startUnix: number;
    endUnix: number;
  }): Promise<MetaInsightsBlock> {
    const empty: MetaInsightsBlock = {
      available: false,
      error: null,
      displayPhoneNumber: null,
      sent: null,
      delivered: null,
      deliveryRatePercent: null,
      conversations: null,
      conversationCost: null,
    };

    if (!params.token || !params.phoneNumberId || !params.businessAccountId) {
      return {
        ...empty,
        error: 'Canal sem token, phoneNumberId ou businessAccountId',
      };
    }

    try {
      const service = new WhatsAppOfficialService({
        token: params.token,
        phoneNumberId: params.phoneNumberId,
        businessAccountId: params.businessAccountId,
      });

      const displayPhoneNumber = await service.getDisplayPhoneNumberDigits();
      const analytics = await service.getWabaMessageAnalytics({
        startUnix: params.startUnix,
        endUnix: params.endUnix,
        granularity: 'DAY',
        phoneNumberDigits: displayPhoneNumber,
      });

      let conversations: number | null = null;
      let conversationCost: number | null = null;
      try {
        const conv = await service.getWabaConversationAnalytics({
          startUnix: params.startUnix,
          endUnix: params.endUnix,
          granularity: 'DAILY',
        });
        conversations = conv.conversation;
        conversationCost = conv.cost;
      } catch (convErr: any) {
        // Insights de conversa exigem permissão extra; não invalida sent/delivered.
        console.warn(
          '[MetaDeliveryMetrics] conversation_analytics indisponível:',
          convErr?.response?.data?.error?.message || convErr?.message,
        );
      }

      return {
        available: true,
        error: null,
        displayPhoneNumber,
        sent: analytics.sent,
        delivered: analytics.delivered,
        deliveryRatePercent: rate(analytics.delivered, analytics.sent),
        conversations,
        conversationCost,
      };
    } catch (error: any) {
      const metaMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Falha ao consultar Insights da Meta';
      console.warn('[MetaDeliveryMetrics] Insights Meta falhou:', metaMsg);
      return {
        ...empty,
        error: String(metaMsg).slice(0, 240),
      };
    }
  }
}

export const metaDeliveryMetricsService = new MetaDeliveryMetricsService();
