import { Prisma } from '@prisma/client';

/** Normaliza query `dates` (CSV ou array) em YYYY-MM-DD únicos, max 62 dias. */
export function parseDashboardDates(raw: unknown): string[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) parts.push(String(item));
  } else if (typeof raw === 'string' && raw.trim()) {
    parts.push(...raw.split(/[,|]/));
  }

  const unique = new Set<string>();
  for (const part of parts) {
    const d = part.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) unique.add(d);
  }

  return Array.from(unique).sort().slice(0, 62);
}

export function parseOptionalId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return v || undefined;
}

/** Início do dia (local) para YYYY-MM-DD. */
export function startOfLocalDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Início do dia seguinte (exclusivo). */
export function endExclusiveLocalDay(isoDate: string): Date {
  const start = startOfLocalDay(isoDate);
  start.setDate(start.getDate() + 1);
  return start;
}

export type DayRange = { gte: Date; lt: Date };

export function dateStringsToRanges(dates: string[]): DayRange[] {
  return dates.map((iso) => ({
    gte: startOfLocalDay(iso),
    lt: endExclusiveLocalDay(iso),
  }));
}

/** Condição Prisma OR por dias selecionados (campo DateTime). */
export function prismaDateOrFilter(
  field: string,
  dates: string[],
): Record<string, unknown> | null {
  if (!dates.length) return null;
  const ranges = dateStringsToRanges(dates);
  return {
    OR: ranges.map((r) => ({
      [field]: { gte: r.gte, lt: r.lt },
    })),
  };
}

/**
 * Fragmento SQL para campo timestamp com dias selecionados.
 * Ex.: buildSqlDateOr('c."createdAt"', dates)
 */
export function buildSqlDateOr(columnSql: string, dates: string[]): Prisma.Sql {
  if (!dates.length) return Prisma.empty;
  const ranges = dateStringsToRanges(dates);
  const parts = ranges.map(
    (r) => Prisma.sql`(${Prisma.raw(columnSql)} >= ${r.gte} AND ${Prisma.raw(columnSql)} < ${r.lt})`,
  );
  return Prisma.sql` AND (${Prisma.join(parts, ' OR ')})`;
}

/** Janela contínua min→max+1 para APIs externas (ex.: Meta Insights). */
export function continuousWindowFromDates(dates: string[]): { start: Date; end: Date } | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  return {
    start: startOfLocalDay(sorted[0]),
    end: endExclusiveLocalDay(sorted[sorted.length - 1]),
  };
}

export function startDateFromDays(days: number): Date {
  const d = Math.min(Math.max(Math.floor(days) || 30, 1), 366);
  const start = new Date();
  start.setDate(start.getDate() - d);
  start.setHours(0, 0, 0, 0);
  return start;
}
