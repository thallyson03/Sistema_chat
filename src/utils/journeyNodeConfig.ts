/** Normaliza config de nó de jornada (Prisma Json pode vir como string). */
export function parseJourneyNodeConfig(config: unknown): Record<string, any> {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
  if (typeof config === 'object') return config as Record<string, any>;
  return {};
}
