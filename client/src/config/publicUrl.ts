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

/** metadata.mediaUrl pode ser absoluto ou path começando com / */
export function resolveMediaMetadataUrl(mediaUrl: string): string {
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return mediaUrl;
  }
  const origin = getPublicApiOrigin();
  const path = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${origin}${path}`;
}
