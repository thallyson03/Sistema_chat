export type JourneyDelayParts = {
  hours: number;
  minutes: number;
  seconds: number;
};

export function normalizeJourneyDelayConfig(config: Record<string, unknown>): JourneyDelayParts {
  if (
    config.delayHours !== undefined ||
    config.delayMinutes !== undefined ||
    config.delaySeconds !== undefined
  ) {
    return {
      hours: Math.max(0, Math.floor(Number(config.delayHours) || 0)),
      minutes: Math.max(0, Math.min(59, Math.floor(Number(config.delayMinutes) || 0))),
      seconds: Math.max(0, Math.min(59, Math.floor(Number(config.delaySeconds) || 0))),
    };
  }

  const value = Math.max(0, Number(config.delayValue) || 0);
  const unit = String(config.delayUnit || 'hours').toLowerCase();

  switch (unit) {
    case 'seconds':
      return { hours: 0, minutes: 0, seconds: value };
    case 'minutes':
      return { hours: 0, minutes: value, seconds: 0 };
    case 'days':
      return { hours: value * 24, minutes: 0, seconds: 0 };
    case 'hours':
    default:
      return { hours: value, minutes: 0, seconds: 0 };
  }
}

export function journeyDelayPartsToMs(parts: JourneyDelayParts): number {
  const totalSeconds = parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
  return totalSeconds * 1000;
}

export function formatJourneyDelayParts(parts: JourneyDelayParts): string {
  const bits: string[] = [];
  if (parts.hours > 0) bits.push(`${parts.hours}h`);
  if (parts.minutes > 0) bits.push(`${parts.minutes}min`);
  if (parts.seconds > 0) bits.push(`${parts.seconds}s`);
  return bits.length > 0 ? bits.join(' ') : '0s';
}

export function isJourneyDelayConfigured(config: Record<string, unknown>): boolean {
  return journeyDelayPartsToMs(normalizeJourneyDelayConfig(config)) > 0;
}

/** Limite atual do motor síncrono de jornadas (backend). */
export const JOURNEY_MAX_SYNC_DELAY_MS = 30_000;

export function applyDelayPartsToConfig(
  config: Record<string, unknown>,
  parts: JourneyDelayParts,
): Record<string, unknown> {
  return {
    ...config,
    delayHours: parts.hours,
    delayMinutes: parts.minutes,
    delaySeconds: parts.seconds,
  };
}
