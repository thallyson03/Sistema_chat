/**
 * Resolve a URL base pública do app (scheme + host) para montar links de mídia
 * acessíveis pela Meta / Evolution. Rejeita valores inválidos como só "https"
 * (erro comum quando API_BASE_URL é preenchido sem domínio).
 */
const VALID_BASE = /^https?:\/\/[^/]+/i;

export function isValidPublicBaseUrl(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const t = value.trim().replace(/\/$/, '');
  return VALID_BASE.test(t);
}

export function normalizePublicBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

/**
 * Primeiro candidato válido: override (ex.: config do canal) e depois variáveis de ambiente.
 * Ordem: override → PUBLIC_APP_URL → APP_URL → API_BASE_URL → NGROK_URL → CORS_ORIGIN.
 * Assim API_BASE_URL="https" inválido não bloqueia se APP_URL estiver correto.
 */
export function resolvePublicAppBaseUrl(override?: string | null): string | null {
  const candidates: string[] = [];

  if (override != null && String(override).trim() !== '') {
    candidates.push(String(override).trim());
  }

  candidates.push(
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.API_BASE_URL,
    process.env.NGROK_URL,
  );

  const cors = process.env.CORS_ORIGIN;
  if (cors) {
    for (const part of cors.split(',')) {
      const p = part.trim();
      if (p) candidates.push(p);
    }
  }

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = normalizePublicBaseUrl(raw);
    if (VALID_BASE.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}
