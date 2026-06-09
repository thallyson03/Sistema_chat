import { isUrlAllowedForFetch, isUrlSafeForOutboundRequest } from './securityHelpers';
import { resolvePublicAppBaseUrl } from './publicBaseUrl';

function extractMediaFilename(mediaUrl: string): string | null {
  if (!mediaUrl.includes('/api/media/file/')) return null;
  const filename = mediaUrl.split('/api/media/file/')[1]?.split('?')[0];
  if (!filename || filename.includes('..') || filename.includes('/')) return null;
  return filename;
}

/**
 * Valida mediaUrl enviada pelo cliente antes de fetch server-side ou envio externo.
 */
export function validateInboundMediaUrl(mediaUrl: string): { ok: true } | { ok: false; error: string } {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return { ok: false, error: 'mediaUrl inválida' };
  }

  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'mediaUrl inválida' };
  }

  const localFilename = extractMediaFilename(trimmed);
  if (localFilename) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const publicBase = resolvePublicAppBaseUrl();
      if (!publicBase) {
        return { ok: false, error: 'URL pública do CRM não configurada para mídia remota' };
      }
      try {
        const allowedOrigin = new URL(publicBase).origin;
        if (new URL(trimmed).origin !== allowedOrigin) {
          return { ok: false, error: 'URL de mídia local deve usar o domínio do CRM' };
        }
      } catch {
        return { ok: false, error: 'URL de mídia inválida' };
      }
    }
    return { ok: true };
  }

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { ok: false, error: 'Apenas paths /api/media/file/ são permitidos para mídia local' };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!isUrlSafeForOutboundRequest(trimmed)) {
      return { ok: false, error: 'URL de mídia aponta para host não permitido' };
    }
    if (!isUrlAllowedForFetch(trimmed)) {
      return { ok: false, error: 'URL de mídia externa não permitida' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Formato de mediaUrl não suportado' };
}
