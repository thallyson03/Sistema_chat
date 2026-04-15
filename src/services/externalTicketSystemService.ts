import axios from 'axios';
import * as crypto from 'crypto';
import prisma from '../config/database';

function isEnabled(): boolean {
  const v = process.env.EXTERNAL_TICKET_ENABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

function apiBase(): string | null {
  const raw = (process.env.EXTERNAL_TICKET_API_BASE_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}

function portalBase(): string | null {
  const raw = (process.env.EXTERNAL_TICKET_PORTAL_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}

function ssoExchangePath(): string {
  const p = (process.env.EXTERNAL_TICKET_SSO_EXCHANGE_PATH || '/api/v1/sso/exchange').trim();
  return p.startsWith('/') ? p : `/${p}`;
}

function ssoSharedSecret(): string {
  return (process.env.EXTERNAL_TICKET_SSO_SHARED_SECRET || '').trim();
}

function ssoExpSeconds(): number {
  const raw = Number(process.env.EXTERNAL_TICKET_SSO_EXP_SECONDS || '90');
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.floor(raw);
}

function ssoEnabled(): boolean {
  const v = process.env.EXTERNAL_TICKET_SSO_ENABLED;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

function createPath(): string {
  const p = (process.env.EXTERNAL_TICKET_CREATE_PATH || '/users').trim();
  return p.startsWith('/') ? p : `/${p}`;
}

function sendPasswordInCreate(): boolean {
  const v = process.env.EXTERNAL_TICKET_SEND_PASSWORD;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

function parseExtraBody(): Record<string, unknown> {
  const raw = (process.env.EXTERNAL_TICKET_CREATE_BODY_EXTRA || '').trim();
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    console.warn('[ExternalTicket] EXTERNAL_TICKET_CREATE_BODY_EXTRA inválido (JSON), ignorando.');
    return {};
  }
}

function authHeaders(): Record<string, string> {
  const token = (process.env.EXTERNAL_TICKET_API_TOKEN || '').trim();
  const headerName = (process.env.EXTERNAL_TICKET_API_KEY_HEADER || '').trim();
  if (headerName && token) {
    return { [headerName]: token };
  }
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

function extractRemoteUserId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidates = [
    d.id,
    d.userId,
    (d.user as Record<string, unknown> | undefined)?.id,
    (d.data as Record<string, unknown> | undefined)?.id,
    (d.result as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return null;
}

export interface CreateRemoteTicketUserInput {
  localUserId: string;
  email: string;
  name: string;
  plainPassword: string;
}

/**
 * Cria usuário no sistema externo de tickets e persiste ticketSystemUserId no User.
 * Respeita EXTERNAL_TICKET_ENABLED. Falhas são logadas; erro opcional em ticketSystemSyncError.
 */
export async function syncUserToExternalTicketSystem(input: CreateRemoteTicketUserInput): Promise<void> {
  if (!isEnabled()) return;

  const base = apiBase();
  const headers = authHeaders();
  const tokenConfigured = (process.env.EXTERNAL_TICKET_API_TOKEN || '').trim().length > 0;
  if (!base || !tokenConfigured) {
    const msg = 'EXTERNAL_TICKET_API_BASE_URL ou EXTERNAL_TICKET_API_TOKEN não configurados';
    console.error('[ExternalTicket]', msg);
    await prisma.user.update({
      where: { id: input.localUserId },
      data: { ticketSystemSyncError: msg },
    });
    return;
  }

  const url = `${base}${createPath()}`;
  const body: Record<string, unknown> = {
    email: input.email,
    name: input.name,
    ...parseExtraBody(),
  };
  if (sendPasswordInCreate()) {
    body.password = input.plainPassword;
  }
  // Correlação estável para o sistema externo (muitas APIs aceitam campo customizado ou ignoram)
  body.externalUserId = input.localUserId;
  body.localUserId = input.localUserId;

  try {
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: Number(process.env.EXTERNAL_TICKET_API_TIMEOUT_MS || '20000') || 20000,
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const remoteId = extractRemoteUserId(res.data);
    if (!remoteId) {
      const msg = 'Resposta da API de tickets sem ID de usuário reconhecido (id / userId / data.id)';
      console.error('[ExternalTicket]', msg, res.data);
      await prisma.user.update({
        where: { id: input.localUserId },
        data: {
          ticketSystemSyncError: msg,
          ticketSystemSyncedAt: new Date(),
        },
      });
      maybeThrowStrict(msg);
      return;
    }

    await prisma.user.update({
      where: { id: input.localUserId },
      data: {
        ticketSystemUserId: remoteId,
        ticketSystemSyncedAt: new Date(),
        ticketSystemSyncError: null,
      },
    });
    console.log('[ExternalTicket] Usuário sincronizado:', input.email, '->', remoteId);
  } catch (err: unknown) {
    const ax = axios.isAxiosError(err);
    const msg = ax
      ? `${err.response?.status || '?'}` +
        (err.response?.data ? ` ${JSON.stringify(err.response.data).slice(0, 500)}` : ` ${err.message}`)
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('[ExternalTicket] Falha ao criar usuário remoto:', msg);
    await prisma.user.update({
      where: { id: input.localUserId },
      data: {
        ticketSystemSyncError: msg.slice(0, 4000),
        ticketSystemSyncedAt: new Date(),
      },
    });
    maybeThrowStrict(msg);
  }
}

function maybeThrowStrict(message: string): void {
  const v = process.env.EXTERNAL_TICKET_STRICT;
  if (v === '1' || v === 'true' || v === 'yes') {
    throw new Error(`Integração com sistema de tickets falhou: ${message}`);
  }
}

/**
 * URL para abrir o portal de tickets no navegador (mesmo utilizador: email / id remoto na query, se configurado).
 */
export async function getTicketPortalUrlForUserId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      ticketSystemUserId: true,
    },
  });
  if (!user) return null;

  // Fluxo preferencial: exchange SSO com token curto e proteção anti-replay.
  if (ssoEnabled()) {
    const base = apiBase();
    const secret = ssoSharedSecret();
    if (base && secret) {
      const nonce = crypto.randomUUID();
      const exp = Math.floor(Date.now() / 1000) + ssoExpSeconds();
      const identity = (user.ticketSystemUserId || user.email || '').trim();
      if (identity) {
        const signature = crypto
          .createHmac('sha256', secret)
          .update(`${identity}|${nonce}|${exp}`)
          .digest('hex');

        const body: Record<string, unknown> = {
          nonce,
          exp,
          signature,
        };
        if (user.ticketSystemUserId) {
          body.externalUserId = user.ticketSystemUserId;
        } else {
          body.email = user.email;
        }

        try {
          const ssoUrl = `${base}${ssoExchangePath()}`;
          const res = await axios.post(ssoUrl, body, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: Number(process.env.EXTERNAL_TICKET_API_TIMEOUT_MS || '20000') || 20000,
            validateStatus: (s) => s >= 200 && s < 300,
          });
          const redirectUrl = (res.data?.redirectUrl || res.data?.url || '').toString().trim();
          if (redirectUrl) {
            return redirectUrl;
          }
          console.error('[ExternalTicket] SSO exchange sem redirectUrl válido:', res.data);
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err)
            ? `${err.response?.status || '?'} ${JSON.stringify(err.response?.data || err.message).slice(0, 500)}`
            : err instanceof Error
              ? err.message
              : String(err);
          console.error('[ExternalTicket] Falha no SSO exchange:', msg);
        }
      }
    }
  }

  // Fallback legado: URL direta do portal.
  const portal = portalBase();
  if (!portal) return null;
  const passEmail = process.env.EXTERNAL_TICKET_PORTAL_PASS_EMAIL;
  const append =
    passEmail === '1' || passEmail === 'true'
      ? `?email=${encodeURIComponent(user.email)}` +
        (user.ticketSystemUserId
          ? `&ticket_user_id=${encodeURIComponent(user.ticketSystemUserId)}`
          : '')
      : '';
  const extra = (process.env.EXTERNAL_TICKET_PORTAL_QUERY || '').trim();
  const sep = append.includes('?') ? '&' : '?';
  const suffix = extra ? (append ? `${sep}${extra.replace(/^\?/, '')}` : `?${extra.replace(/^\?/, '')}`) : append;
  return `${portal}${suffix}`;
}

export function isTicketPortalConfigured(): boolean {
  const hasSso = !!apiBase() && !!ssoSharedSecret();
  return hasSso || !!portalBase();
}
