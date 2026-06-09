const SECRET_MASK = '***';

const SECRET_CONFIG_KEYS = new Set([
  'token',
  'appSecret',
  'apiKey',
  'secret',
  'webhookSecret',
  'metaAppSecret',
  'whatsappAppSecret',
  'accessToken',
]);

export function sanitizeConfigForRead(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const cloned = { ...(config as Record<string, unknown>) };
  for (const key of Object.keys(cloned)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof cloned[key] === 'string' && cloned[key]) {
      cloned[key] = SECRET_MASK;
    }
  }
  return cloned;
}

export function sanitizeChannelForRead<T extends Record<string, unknown>>(
  channel: T | null | undefined,
): T | null | undefined {
  if (!channel) return channel;
  const cloned = { ...channel } as T & {
    config?: unknown;
    evolutionApiKey?: string;
    evolutionInstanceToken?: string;
  };
  if (cloned.config) {
    cloned.config = sanitizeConfigForRead(cloned.config) as T['config'];
  }
  if (cloned.evolutionApiKey) cloned.evolutionApiKey = SECRET_MASK;
  if (cloned.evolutionInstanceToken) cloned.evolutionInstanceToken = SECRET_MASK;
  return cloned;
}

export function sanitizeConversationForApi<T extends Record<string, unknown>>(
  conversation: T | null | undefined,
): T | null | undefined {
  if (!conversation || typeof conversation !== 'object') return conversation;
  const cloned: Record<string, unknown> = { ...conversation };
  if (cloned.channel && typeof cloned.channel === 'object') {
    cloned.channel = sanitizeChannelForRead(
      cloned.channel as Record<string, unknown>,
    );
  }
  return cloned as T;
}

export function sanitizeConversationsForApi<T extends Record<string, unknown>>(
  conversations: T[],
): T[] {
  return conversations.map((conv) => sanitizeConversationForApi(conv) as T);
}
