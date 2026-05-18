/**
 * Normaliza telefone para E.164 simplificado (apenas dígitos).
 * Opcionalmente garante prefixo 55 para números BR com 10–11 dígitos locais.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length <= 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function assertValidPhone(raw: string): string {
  const normalized = normalizePhone(raw);
  if (!normalized) {
    throw new Error('Telefone inválido. Informe um número com pelo menos 10 dígitos.');
  }
  return normalized;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}
