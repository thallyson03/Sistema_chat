/**
 * Controle de epoch de sessão — incremente AUTH_SESSION_EPOCH no deploy
 * para invalidar JWTs emitidos antes da atualização.
 */
export function getAuthSessionEpoch(): string {
  return (process.env.AUTH_SESSION_EPOCH || '1').trim();
}

export function isAccessTokenEpochValid(tokenEpoch: unknown): boolean {
  const expected = getAuthSessionEpoch();
  return typeof tokenEpoch === 'string' && tokenEpoch === expected;
}

/**
 * Refresh tokens criados antes desta data são rejeitados (força novo login após deploy).
 * Ex.: AUTH_REFRESH_NOT_BEFORE=2026-06-09T12:00:00.000Z
 */
export function getRefreshNotBeforeDate(): Date | null {
  const raw = (process.env.AUTH_REFRESH_NOT_BEFORE || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isRefreshTokenIssuedBeforeCutoff(createdAt: Date): boolean {
  const cutoff = getRefreshNotBeforeDate();
  if (!cutoff) return false;
  return createdAt < cutoff;
}
