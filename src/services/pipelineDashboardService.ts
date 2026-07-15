import { DealStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AccessViewer, canAccessPipeline, getUserPipelineIds } from '../utils/accessControl';
import {
  continuousWindowFromDates,
  prismaDateOrFilter,
  startDateFromDays,
} from '../utils/dashboardDateFilter';

export interface PipelineDashboardFilters {
  days?: number;
  pipelineId?: string;
  assignedToId?: string;
  dates?: string[];
}

function parseDays(raw: number | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function periodFilter(
  field: 'createdAt' | 'closedAt' | 'updatedAt',
  dates: string[],
  start: Date,
): Prisma.DealWhereInput {
  const dateOr = prismaDateOrFilter(field, dates);
  if (dateOr) return dateOr as Prisma.DealWhereInput;
  return { [field]: { gte: start } } as Prisma.DealWhereInput;
}

export class PipelineDashboardService {
  private async buildScopeWhere(
    viewer: AccessViewer,
    filters: PipelineDashboardFilters,
  ): Promise<Prisma.DealWhereInput | null> {
    if (filters.pipelineId) {
      const allowed = await canAccessPipeline(viewer, filters.pipelineId);
      if (!allowed) return null;
    }

    const allowedPipelineIds = await getUserPipelineIds(viewer);
    const and: Prisma.DealWhereInput[] = [];

    if (filters.pipelineId) {
      and.push({ pipelineId: filters.pipelineId });
    } else if (allowedPipelineIds !== null) {
      if (allowedPipelineIds.length === 0) {
        return { id: '__no_access__' };
      }
      and.push({ pipelineId: { in: allowedPipelineIds } });
    }

    if (filters.assignedToId) {
      and.push({ assignedToId: filters.assignedToId });
    }

    if (and.length === 0) return {};
    return { AND: and };
  }

  async getDashboardMetrics(viewer: AccessViewer, filters: PipelineDashboardFilters = {}) {
    const selectedDates = Array.isArray(filters.dates) ? filters.dates : [];
    const days = parseDays(filters.days);
    const continuous = continuousWindowFromDates(selectedDates);
    const start = continuous?.start ?? startDateFromDays(days);
    const scopeWhere = await this.buildScopeWhere(viewer, filters);

    if (scopeWhere === null) {
      throw new Error('Acesso negado para este pipeline');
    }

    const baseWhere: Prisma.DealWhereInput =
      scopeWhere.id === '__no_access__'
        ? scopeWhere
        : Object.keys(scopeWhere).length === 0
          ? {}
          : scopeWhere;

    const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const createdInPeriod = periodFilter('createdAt', selectedDates, start);
    const closedInPeriodFilter = periodFilter('closedAt', selectedDates, start);
    const updatedInPeriod = periodFilter('updatedAt', selectedDates, start);

    const openWhere: Prisma.DealWhereInput = {
      AND: [baseWhere, { status: DealStatus.OPEN }],
    };

    const [
      openDeals,
      newInPeriod,
      wonInPeriod,
      lostInPeriod,
      abandonedInPeriod,
      wonValueAgg,
      wonDealsForCycle,
      wonDealsForAssignees,
      overdueTasks,
      staleDeals,
      unassignedOpen,
      linkedConversationOpen,
    ] = await Promise.all([
      prisma.deal.findMany({
        where: openWhere,
        select: {
          value: true,
          assignedToId: true,
          conversationId: true,
          stage: {
            select: {
              id: true,
              name: true,
              order: true,
              color: true,
              probability: true,
            },
          },
        },
      }),
      prisma.deal.count({
        where: { AND: [baseWhere, createdInPeriod] },
      }),
      prisma.deal.count({
        where: {
          AND: [baseWhere, { status: DealStatus.WON }, closedInPeriodFilter],
        },
      }),
      prisma.deal.count({
        where: {
          AND: [baseWhere, { status: DealStatus.LOST }, closedInPeriodFilter],
        },
      }),
      prisma.deal.count({
        where: {
          AND: [baseWhere, { status: DealStatus.ABANDONED }, updatedInPeriod],
        },
      }),
      prisma.deal.aggregate({
        where: {
          AND: [baseWhere, { status: DealStatus.WON }, closedInPeriodFilter],
        },
        _sum: { value: true },
      }),
      prisma.deal.findMany({
        where: {
          AND: [
            baseWhere,
            { status: DealStatus.WON, closedAt: { not: null } },
            closedInPeriodFilter,
          ],
        },
        select: { createdAt: true, closedAt: true },
      }),
      prisma.deal.findMany({
        where: {
          AND: [baseWhere, { status: DealStatus.WON }, closedInPeriodFilter],
        },
        select: {
          value: true,
          assignedToId: true,
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.pipelineTask.count({
        where: {
          status: 'PENDING',
          dueDate: { lt: now },
          deal: { is: baseWhere },
        },
      }),
      prisma.deal.count({
        where: {
          AND: [baseWhere, { status: DealStatus.OPEN, updatedAt: { lt: staleCutoff } }],
        },
      }),
      prisma.deal.count({
        where: {
          AND: [baseWhere, { status: DealStatus.OPEN, assignedToId: null }],
        },
      }),
      prisma.deal.count({
        where: {
          AND: [
            baseWhere,
            { status: DealStatus.OPEN, conversationId: { not: null } },
          ],
        },
      }),
    ]);

    let openValue = 0;
    let forecastValue = 0;
    const stageMap = new Map<
      string,
      { stageId: string; name: string; order: number; color: string; openCount: number; openValue: number }
    >();

    for (const deal of openDeals) {
      const val = toNumber(deal.value);
      openValue += val;
      const prob = deal.stage?.probability ?? 0;
      forecastValue += val * (prob / 100);

      const stageId = deal.stage?.id || 'unknown';
      const existing = stageMap.get(stageId);
      if (existing) {
        existing.openCount += 1;
        existing.openValue += val;
      } else {
        stageMap.set(stageId, {
          stageId,
          name: deal.stage?.name || 'Sem etapa',
          order: deal.stage?.order ?? 999,
          color: deal.stage?.color || '#6B7280',
          openCount: 1,
          openValue: val,
        });
      }
    }

    const closedInPeriod = wonInPeriod + lostInPeriod;
    const winRatePercent =
      closedInPeriod > 0 ? Math.round((wonInPeriod / closedInPeriod) * 1000) / 10 : null;

    let avgCycleDays: number | null = null;
    if (wonDealsForCycle.length > 0) {
      const totalDays = wonDealsForCycle.reduce((sum, d) => {
        if (!d.closedAt) return sum;
        const ms = d.closedAt.getTime() - d.createdAt.getTime();
        return sum + ms / (1000 * 60 * 60 * 24);
      }, 0);
      avgCycleDays = Math.round((totalDays / wonDealsForCycle.length) * 10) / 10;
    }

    const assigneeMap = new Map<
      string,
      { userId: string; name: string; wonInPeriod: number; wonValueInPeriod: number }
    >();
    for (const deal of wonDealsForAssignees) {
      const userId = deal.assignedToId || '__unassigned__';
      const name = deal.assignedTo?.name || 'Sem responsável';
      const existing = assigneeMap.get(userId);
      const val = toNumber(deal.value);
      if (existing) {
        existing.wonInPeriod += 1;
        existing.wonValueInPeriod += val;
      } else {
        assigneeMap.set(userId, {
          userId,
          name,
          wonInPeriod: 1,
          wonValueInPeriod: val,
        });
      }
    }

    const openByAssignee = new Map<string, { userId: string; name: string; openCount: number }>();
    for (const deal of openDeals) {
      const userId = deal.assignedToId || '__unassigned__';
      const existing = openByAssignee.get(userId);
      if (existing) {
        existing.openCount += 1;
      } else {
        openByAssignee.set(userId, { userId, name: userId === '__unassigned__' ? 'Sem responsável' : userId, openCount: 1 });
      }
    }

    // Enrich assignee names for open counts
    const assigneeIds = [...openByAssignee.keys()].filter((id) => id !== '__unassigned__');
    if (assigneeIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(users.map((u) => [u.id, u.name]));
      for (const [id, row] of openByAssignee) {
        if (id !== '__unassigned__' && nameById.has(id)) {
          row.name = nameById.get(id)!;
        }
      }
    }

    const topAssignees = [...assigneeMap.values()]
      .sort((a, b) => b.wonValueInPeriod - a.wonValueInPeriod || b.wonInPeriod - a.wonInPeriod)
      .slice(0, 8)
      .map((row) => ({
        ...row,
        openCount: openByAssignee.get(row.userId)?.openCount ?? 0,
      }));

    const stageFunnel = [...stageMap.values()].sort((a, b) => a.order - b.order);

    return {
      periodDays: selectedDates.length || days,
      periodStart: start.toISOString(),
      selectedDates: selectedDates.length ? selectedDates : null,
      filters: {
        pipelineId: filters.pipelineId || null,
        assignedToId: filters.assignedToId || null,
        dates: selectedDates.length ? selectedDates : null,
      },
      summary: {
        openCount: openDeals.length,
        openValue,
        forecastValue,
        newInPeriod,
        wonInPeriod,
        lostInPeriod,
        abandonedInPeriod,
        wonValueInPeriod: toNumber(wonValueAgg._sum.value),
        winRatePercent,
        avgCycleDays,
        unassignedOpen,
        linkedToConversation: linkedConversationOpen,
      },
      stageFunnel,
      topAssignees,
      alerts: {
        overdueTasks,
        staleDeals,
      },
    };
  }
}
