export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    pause: (userId?: string) => ['auth', 'pause', userId] as const,
  },
  channels: ['channels'] as const,
  sectors: (includeInactive = false) => ['sectors', { includeInactive }] as const,
  users: (params?: Record<string, unknown>) => ['users', params ?? {}] as const,
  conversations: (filters?: Record<string, unknown>) => ['conversations', filters ?? {}] as const,
  pipelines: ['pipelines'] as const,
  pipeline: (id: string) => ['pipeline', id] as const,
  tickets: (params?: Record<string, unknown>) => ['tickets', params ?? {}] as const,
  quickReplies: ['quickReplies'] as const,
  bots: ['bots'] as const,
  integrations: ['integrations'] as const,
  journeys: ['journeys'] as const,
  contactLists: ['contactLists'] as const,
  auditLogs: (params?: Record<string, unknown>) => ['auditLogs', params ?? {}] as const,
};
