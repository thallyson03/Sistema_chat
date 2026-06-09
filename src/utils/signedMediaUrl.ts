import crypto from 'crypto';
import { timingSafeEqualText } from './securityHelpers';
import { resolvePublicAppBaseUrl } from './publicBaseUrl';

function getMediaSigningSecret(): string {
  const secret =
    process.env.MEDIA_SIGNED_URL_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    throw new Error('MEDIA_SIGNED_URL_SECRET ou JWT_SECRET é obrigatório');
  }
  return secret;
}

export function getMediaSignedUrlTtlSeconds(): number {
  return Number(process.env.MEDIA_SIGNED_URL_TTL_SECONDS || 300);
}

export function signMediaFilename(filename: string): { expires: number; sig: string } {
  const ttl = getMediaSignedUrlTtlSeconds();
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const sig = crypto
    .createHmac('sha256', getMediaSigningSecret())
    .update(`${filename}.${expires}`)
    .digest('hex');
  return { expires, sig };
}

export function verifySignedMediaFilename(
  filename: string,
  expiresRaw: string | undefined,
  sigRaw: string | undefined,
): boolean {
  if (!expiresRaw || !sigRaw) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', getMediaSigningSecret())
    .update(`${filename}.${expires}`)
    .digest('hex');
  return timingSafeEqualText(sigRaw, expected);
}

export function buildSignedMediaFilePath(filename: string): string {
  const { expires, sig } = signMediaFilename(filename);
  return `/api/media/file/${filename}?expires=${expires}&sig=${sig}`;
}

export function buildSignedMediaFileUrl(
  filename: string,
  baseUrlOverride?: string | null,
): string {
  const base = baseUrlOverride || resolvePublicAppBaseUrl() || '';
  const path = buildSignedMediaFilePath(filename);
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

export function appendSignatureToMediaUrl(mediaUrl: string): string {
  if (!mediaUrl.includes('/api/media/file/')) return mediaUrl;
  const [base, query] = mediaUrl.split('?');
  if (query && query.includes('sig=')) return mediaUrl;

  const filename = base.split('/api/media/file/')[1];
  if (!filename) return mediaUrl;

  const { expires, sig } = signMediaFilename(filename);
  const separator = query ? '&' : '?';
  const existingQuery = query ? `${query}&` : '';
  return `${base}?${existingQuery}expires=${expires}&sig=${sig}`;
}
