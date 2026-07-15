import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import {
  buildSqlDateOr,
  continuousWindowFromDates,
  startDateFromDays,
} from '../utils/dashboardDateFilter';

export type DashboardUserPerformance = {
  userId: string;
  name: string;
  messagesSent: number;
  conversationsTouched: number;
};

export type DashboardPerformancePayload = {
  periodDays: number;
  periodStart: string;
  selectedDates?: string[] | null;
  tempo: {
    avgFirstResponseMinutes: number | null;
    firstResponseSampleSize: number;
    avgClosedConversationMinutes: number | null;
    closedConversationsSampleSize: number;
  };
  usuarios: DashboardUserPerformance[];
};

type DashboardViewer = {
  id: string;
  role: string;
};

export class DashboardPerformanceService {
  async getInsights(
    rawDays: number,
    viewer?: DashboardViewer,
    filters?: {
      channelId?: string;
      sectorId?: string;
      assignedToId?: string;
      dates?: string[];
    },
  ): Promise<DashboardPerformancePayload> {
    const selectedDates = Array.isArray(filters?.dates) ? filters!.dates! : [];
    const periodDays = Math.min(Math.max(Math.floor(Number(rawDays)) || 30, 1), 366);
    const continuous = continuousWindowFromDates(selectedDates);
    const start = continuous?.start ?? startDateFromDays(periodDays);

    const scopedUserId =
      viewer && viewer.role !== 'ADMIN' ? (viewer.id ? viewer.id : '__no_access__') : null;
    const assigneeId = filters?.assignedToId || scopedUserId;
    const scopedConversationFilter = assigneeId
      ? Prisma.sql` AND c."assignedToId" = ${assigneeId}`
      : Prisma.empty;
    const scopedUserFilter = assigneeId
      ? Prisma.sql` AND u.id = ${assigneeId}`
      : Prisma.empty;
    const channelConversationFilter = filters?.channelId
      ? Prisma.sql` AND c."channelId" = ${filters.channelId}`
      : Prisma.empty;
    const sectorConversationFilter = filters?.sectorId
      ? Prisma.sql` AND c."sectorId" = ${filters.sectorId}`
      : Prisma.empty;
    const createdAtDateFilter = selectedDates.length
      ? buildSqlDateOr('c."createdAt"', selectedDates)
      : Prisma.sql` AND c."createdAt" >= ${start}`;
    const updatedAtDateFilter = selectedDates.length
      ? buildSqlDateOr('c."updatedAt"', selectedDates)
      : Prisma.sql` AND c."updatedAt" >= ${start}`;
    const messageDateFilter = selectedDates.length
      ? buildSqlDateOr('m."createdAt"', selectedDates)
      : Prisma.sql` AND m."createdAt" >= ${start}`;

    let firstResp = { avg: null as number | null, samples: 0 };
    let closedDur = { avg: null as number | null, samples: 0 };

    try {
      const rows = await prisma.$queryRaw<{ avg: Prisma.Decimal | null; samples: bigint | null }[]>`
        WITH first_customer AS (
          SELECT m."conversationId", MIN(m."createdAt") AS t_customer
          FROM "Message" m
          WHERE m."userId" IS NULL
          GROUP BY m."conversationId"
        ),
        first_human AS (
          SELECT m."conversationId", MIN(m."createdAt") AS t_human
          FROM "Message" m
          WHERE m."userId" IS NOT NULL
            AND (
              m.metadata IS NULL
              OR (m.metadata::jsonb ->> 'fromBot') IS NULL
              OR (m.metadata::jsonb ->> 'fromBot') <> 'true'
            )
          GROUP BY m."conversationId"
        )
        SELECT
          AVG(EXTRACT(EPOCH FROM (fh.t_human - fc.t_customer)) / 60.0) AS avg,
          COUNT(*)::bigint AS samples
        FROM first_customer fc
        INNER JOIN first_human fh ON fh."conversationId" = fc."conversationId"
        INNER JOIN "Conversation" c ON c.id = fc."conversationId"
        WHERE fh.t_human > fc.t_customer
          ${createdAtDateFilter}
          ${scopedConversationFilter}
          ${channelConversationFilter}
          ${sectorConversationFilter}
      `;
      const row = rows[0];
      firstResp =
        row && row.avg != null
          ? { avg: Number(row.avg), samples: Number(row.samples || 0) }
          : { avg: null, samples: Number(row?.samples || 0) };
    } catch (e) {
      console.warn('[DashboardPerformance] avgFirstHumanResponseMinutes falhou:', (e as Error)?.message);
    }

    try {
      const rows = await prisma.$queryRaw<{ avg: Prisma.Decimal | null; samples: bigint | null }[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt")) / 60.0) AS avg,
          COUNT(*)::bigint AS samples
        FROM "Conversation" c
        WHERE c.status = 'CLOSED'
          ${updatedAtDateFilter}
          ${scopedConversationFilter}
          ${channelConversationFilter}
          ${sectorConversationFilter}
      `;
      const row = rows[0];
      closedDur =
        row && row.avg != null
          ? { avg: Number(row.avg), samples: Number(row.samples || 0) }
          : { avg: null, samples: Number(row?.samples || 0) };
    } catch (e) {
      console.warn(
        '[DashboardPerformance] avgClosedConversationDurationMinutes falhou:',
        (e as Error)?.message,
      );
    }

    const userRows = await prisma.$queryRaw<
      { userId: string; name: string; messagesSent: bigint; conversationsTouched: bigint }[]
    >`
      SELECT
        u.id AS "userId",
        u.name AS name,
        COUNT(m.id)::bigint AS "messagesSent",
        COUNT(DISTINCT m."conversationId")::bigint AS "conversationsTouched"
      FROM "User" u
      INNER JOIN "Message" m ON m."userId" = u.id
      INNER JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE 1=1
        ${messageDateFilter}
        ${scopedUserFilter}
        ${channelConversationFilter}
        ${sectorConversationFilter}
        AND (
          m.metadata IS NULL
          OR (m.metadata::jsonb ->> 'fromBot') IS NULL
          OR (m.metadata::jsonb ->> 'fromBot') <> 'true'
        )
      GROUP BY u.id, u.name
      ORDER BY COUNT(m.id) DESC
      LIMIT 25
    `;

    const usuarios: DashboardUserPerformance[] = userRows.map((r) => ({
      userId: r.userId,
      name: r.name,
      messagesSent: Number(r.messagesSent),
      conversationsTouched: Number(r.conversationsTouched),
    }));

    return {
      periodDays: selectedDates.length || periodDays,
      periodStart: start.toISOString(),
      selectedDates: selectedDates.length ? selectedDates : null,
      tempo: {
        avgFirstResponseMinutes: firstResp.avg != null ? Math.round(firstResp.avg * 10) / 10 : null,
        firstResponseSampleSize: firstResp.samples,
        avgClosedConversationMinutes:
          closedDur.avg != null ? Math.round(closedDur.avg * 10) / 10 : null,
        closedConversationsSampleSize: closedDur.samples,
      },
      usuarios,
    };
  }
}
