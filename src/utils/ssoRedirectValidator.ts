/**
 * Valida URLs de redirect retornadas por integrações SSO externas (ex.: CEAPDesk).
 */

function parseOrigin(raw: string | null | undefined): string | null {
  const value = (raw || '').trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

export function getSsoRedirectAllowlistOrigins(): string[] {
  const origins = new Set<string>();

  for (const envKey of [
    'EXTERNAL_TICKET_PORTAL_URL',
    'EXTERNAL_TICKET_API_BASE_URL',
    'EXTERNAL_TICKET_SSO_REDIRECT_ALLOWLIST',
  ]) {
    const raw = process.env[envKey];
    if (!raw) continue;

    for (const part of raw.split(',')) {
      const origin = parseOrigin(part);
      if (origin) origins.add(origin);
    }
  }

  return Array.from(origins);
}

export function assertAllowedSsoRedirect(rawUrl: string): string {
  const url = (rawUrl || '').trim();
  if (!url) {
    throw new Error('Redirect SSO vazio');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Redirect SSO com URL inválida');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Redirect SSO com protocolo não permitido');
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Redirect SSO deve usar HTTPS em produção');
  }

  const allowlist = getSsoRedirectAllowlistOrigins();
  if (allowlist.length === 0) {
    throw new Error(
      'Allowlist de redirect SSO não configurada (EXTERNAL_TICKET_PORTAL_URL ou EXTERNAL_TICKET_SSO_REDIRECT_ALLOWLIST)',
    );
  }

  if (!allowlist.includes(parsed.origin)) {
    throw new Error(`Redirect SSO fora do domínio permitido: ${parsed.origin}`);
  }

  return url;
}
