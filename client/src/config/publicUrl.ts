/**
 * Origem pública da API.
 * - Coolify / mesmo domínio: deixe VITE_API_BASE_URL vazio → usa window.location.origin
 * - API em outro host: VITE_API_BASE_URL=https://api.seudominio.com (sem barra final)
 */
export function getPublicApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getMessageMediaUrl(messageId: string): string {
  return `${getPublicApiOrigin()}/api/media/${messageId}`;
}

/** URL que o browser pode carregar sem passar pelo proxy /api/media/:id. */
export function isDirectlyRenderableMediaUrl(
  mediaUrl: string | undefined,
  metadata?: Record<string, unknown> | null,
): boolean {
  if (!mediaUrl || typeof mediaUrl !== 'string') return false;
  if (mediaUrl.startsWith('/api/media/file/')) return true;
  if (metadata?.storageProvider === 'object') return true;
  const mm = metadata?.mediaMetadata as Record<string, unknown> | undefined;
  if (mm?.storageKey) return true;
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    if (/mmg\.whatsapp\.net|whatsapp\.net|pps\.whatsapp/i.test(mediaUrl)) {
      return false;
    }
    return true;
  }
  return false;
}

/** Preview de mídia: sempre via backend para Evolution/WhatsApp CDN. */
export function resolveMessageMediaPreviewUrl(message: {
  id: string;
  metadata?: {
    mediaUrl?: string;
    storageProvider?: string;
    mediaMetadata?: { storageKey?: string };
  };
}): string {
  const metaUrl = message.metadata?.mediaUrl;
  if (metaUrl && isDirectlyRenderableMediaUrl(metaUrl, message.metadata as Record<string, unknown>)) {
    return resolveMediaMetadataUrl(metaUrl);
  }
  return getMessageMediaUrl(message.id);
}

/** metadata.mediaUrl pode ser absoluto ou path começando com / */
export function resolveMediaMetadataUrl(mediaUrl: string): string {
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return mediaUrl;
  }
  const origin = getPublicApiOrigin();
  const path = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${origin}${path}`;
}
