import { appendSignatureToMediaUrl } from './signedMediaUrl';
import { resolvePublicAppBaseUrl } from './publicBaseUrl';

/**
 * Monta URL pública acessível por Meta/Evolution.
 * Com MinIO, o arquivo fica no bucket e o proxy CRM (/api/media/file/) serve via presigned.
 */
export function resolveOutboundMediaUrl(
  mediaUrl: string,
  baseUrlOverride?: string | null,
): string {
  if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl;

  const base = (baseUrlOverride || resolvePublicAppBaseUrl() || '').replace(/\/$/, '');

  let path = mediaUrl;
  if (mediaUrl.includes('/api/media/file/')) {
    path = appendSignatureToMediaUrl(mediaUrl);
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}
