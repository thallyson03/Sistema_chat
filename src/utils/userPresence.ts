/** Alinhado à distribuição de conversas: "online" = atividade nos últimos 5 minutos. */
export const USER_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function userPresenceFromLastActiveAt(
  lastActiveAt: Date | string | null | undefined,
): { isOnline: boolean; presenceSummary: string } {
  if (lastActiveAt == null) {
    return { isOnline: false, presenceSummary: 'Sem registro no sistema' };
  }
  const t = new Date(lastActiveAt).getTime();
  if (Number.isNaN(t)) {
    return { isOnline: false, presenceSummary: 'Sem registro no sistema' };
  }

  const ago = Date.now() - t;
  if (ago >= 0 && ago < USER_ONLINE_WINDOW_MS) {
    return { isOnline: true, presenceSummary: 'No sistema agora' };
  }

  const minutes = Math.floor(ago / 60_000);
  if (minutes < 60) {
    return { isOnline: false, presenceSummary: `Última atividade há ${minutes} min` };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return { isOnline: false, presenceSummary: `Última atividade há ${hours} h` };
  }
  const days = Math.floor(hours / 24);
  return { isOnline: false, presenceSummary: `Última atividade há ${days} dia(s)` };
}
