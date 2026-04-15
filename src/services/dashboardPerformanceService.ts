import prisma from '../config/database';
import { Prisma } from '@prisma/client';

function startDateFromDays(days: number): Date {
  const d = Math.min(Math.max(Math.floor(days) || 30, 1), 366);
  const start = new Date();
  start.setDate(start.getDate() - d);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Tempo médio até a primeira resposta humana (não-bot) após a primeira mensagem do cliente,
 * apenas conversas criadas no período.
 */
async function avgFirstHumanResponseMinutes(start: Date): Promise<{ avg: number | null; samples: number }> {
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
      AND c."createdAt" >= ${start}
  `;
  const row = rows[0];
  if (!row || row.avg == null) return { avg: null, samples: Number(row?.samples || 0) };
  return { avg: Number(row.avg), samples: Number(row.samples || 0) };
}

/**
 * Tempo médio "de vida" de conversas fechadas cujo updatedAt está no período (proxy de encerramento).
 */
async function avgClosedConversationDurationMinutes(start: Date): Promise<{ avg: number | null; samples: number }> {
  const rows = await prisma.$queryRaw<{ avg: Prisma.Decimal | null; samples: bigint | null }[]>`
    SELECT
      AVG(EXTRACT(EPOCH FROM (c."updatedAt" - c."createdAt")) / 60.0) AS avg,
      COUNT(*)::bigint AS samples
    FROM "Conversation" c
    WHERE c.status = 'CLOSED'
      AND c."updatedAt" >= ${start}
  `;
  const row = rows[0];
  if (!row || row.avg == null) return { avg: null, samples: Number(row?.samples || 0) };
  return { avg: Number(row.avg), samples: Number(row.samples || 0) };
}

export type DashboardUserPerformance = {
  userId: string;
  name: string;
  messagesSent: number;
  conversationsTouched: number;
};

export type DashboardPerformancePayload = {
  periodDays: number;
  periodStart: string;
  tempo: {
    avgFirstResponseMinutes: number | null;
    firstResponseSampleSize: number;
    avgClosedConversationMinutes: number | null;
    closedConversationsSampleSize: number;
  };
  usuarios: DashboardUserPerformance[];
};

export class DashboardPerformanceService {
  async getInsights(rawDays: number): Promise<DashboardPerformancePayload> {
    const periodDays = Math.min(Math.max(Math.floor(Number(rawDays)) || 30, 1), 366);
    const start = startDateFromDays(periodDays);

    let firstResp = { avg: null as number | null, samples: 0 };
    let closedDur = { avg: null as number | null, samples: 0 };

    try {
      firstResp = await avgFirstHumanResponseMinutes(start);
    } catch (e) {
      console.warn('[DashboardPerformance] avgFirstHumanResponseMinutes falhou:', (e as Error)?.message);
    }

    try {
      closedDur = await avgClosedConversationDurationMinutes(start);
    } catch (e) {
      console.warn('[DashboardPerformance] avgClosedConversationDurationMinutes falhou:', (e as Error)?.message);
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
      WHERE m."createdAt" >= ${start}
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
      periodDays,
      periodStart: start.toISOString(),
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
