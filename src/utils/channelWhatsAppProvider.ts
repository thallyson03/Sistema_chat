import { evolutionApi } from '../config/evolutionApi';
import { evolutionGoApi } from '../config/evolutionGoApi';

export type WhatsAppChannelProvider = 'evolution' | 'evolution_go' | 'whatsapp_official';

export type BaileysApiClient = typeof evolutionApi;

export function getWhatsAppChannelProvider(
  config?: Record<string, unknown> | null,
): WhatsAppChannelProvider {
  const raw = String(config?.provider || 'evolution').toLowerCase();
  if (raw === 'whatsapp_official') return 'whatsapp_official';
  if (raw === 'evolution_go') return 'evolution_go';
  return 'evolution';
}

export function isBaileysWhatsAppChannel(config?: Record<string, unknown> | null): boolean {
  const provider = getWhatsAppChannelProvider(config);
  return provider === 'evolution' || provider === 'evolution_go';
}

export function getBaileysApi(channel?: { config?: unknown } | null): BaileysApiClient {
  return getWhatsAppChannelProvider(channel?.config as Record<string, unknown>) === 'evolution_go'
    ? (evolutionGoApi as unknown as BaileysApiClient)
    : evolutionApi;
}

export function getBaileysResilienceProvider(
  config?: Record<string, unknown> | null,
): 'evolution' | 'evolution_go' {
  return getWhatsAppChannelProvider(config) === 'evolution_go' ? 'evolution_go' : 'evolution';
}

export function resolveBaileysApiKey(
  channel?: {
    config?: unknown;
    evolutionApiKey?: string | null;
    evolutionInstanceToken?: string | null;
  } | null,
): string | undefined {
  if (!channel) return undefined;
  const masked = '***';
  const stored = channel.evolutionApiKey;
  const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);

  if (provider === 'evolution_go') {
    // Envio de mensagens: token da instância (header apikey) tem prioridade
    const instanceToken = channel.evolutionInstanceToken;
    if (instanceToken && instanceToken !== masked) return instanceToken;
    if (stored && stored !== masked) return stored;
    return process.env.EVOLUTION_GO_API_KEY || undefined;
  }

  if (stored && stored !== masked) return stored;
  return process.env.EVOLUTION_API_KEY || undefined;
}

export function getBaileysWebhookPath(channel?: { config?: unknown } | null): string {
  return getWhatsAppChannelProvider(channel?.config as Record<string, unknown>) === 'evolution_go'
    ? '/webhooks/evolution-go'
    : '/webhooks/evolution';
}

export function resolveDefaultBaileysApiKey(provider: WhatsAppChannelProvider): string | undefined {
  if (provider === 'evolution_go') return process.env.EVOLUTION_GO_API_KEY || undefined;
  return process.env.EVOLUTION_API_KEY || undefined;
}

/** API key global (create, list, connect, delete) — não usar token da instância. */
export function resolveBaileysGlobalApiKey(
  channel?: { config?: unknown; evolutionApiKey?: string | null } | null,
): string | undefined {
  const masked = '***';
  const provider = getWhatsAppChannelProvider(channel?.config as Record<string, unknown>);
  const stored = channel?.evolutionApiKey;
  if (stored && stored !== masked) return stored;
  return resolveDefaultBaileysApiKey(provider);
}
