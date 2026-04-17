import axios from 'axios';
import prisma from '../config/database';
import { isExternalTicketEnabled } from './externalTicketSystemService';

export type DashboardViewer = {
  id: string;
  role: string;
};

let cachedJwt: { token: string; expiresAtMs: number } | null = null;

/**
 * Dashboard com dados do CEAPDesk: ligado se `EXTERNAL_TICKET_DASHBOARD_ENABLED` for true,
 * ou (quando essa variável não for definida) quando `EXTERNAL_TICKET_ENABLED` estiver ativo.
 * Use `EXTERNAL_TICKET_DASHBOARD_ENABLED=false` para desligar só o dashboard mantendo tickets/SSO.
 */
export function isCeapdeskDashboardEnabled(): boolean {
  const raw = process.env.EXTERNAL_TICKET_DASHBOARD_ENABLED;
  if (raw !== undefined && String(raw).trim() !== '') {
    const v = String(raw).trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  }
  return isExternalTicketEnabled();
}

function apiBase(): string {
  return (process.env.EXTERNAL_TICKET_API_BASE_URL || '').trim().replace(/\/$/, '');
}

function timeoutMs(): number {
  const n = Number(process.env.EXTERNAL_TICKET_DASHBOARD_TIMEOUT_MS || '30000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30000;
}

/** Prefer email (CEAPDesk costuma resolver por email); opcional: username local. */
function identityField(): 'email' | 'username' {
  const raw = (process.env.EXTERNAL_TICKET_DASHBOARD_USER_IDENTITY || 'email').trim().toLowerCase();
  return raw === 'username' ? 'username' : 'email';
}

/**
 * Valor enviado como query `usuario` para filtrar métricas no CEAPDesk (não-admin).
 */
export async function resolveUsuarioFilter(viewerId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { email: true, name: true },
  });
  if (!user) return null;
  if (identityField() === 'username') {
    const email = (user.email || '').trim();
    const local = email.includes('@') ? email.split('@')[0] : email;
    return local || null;
  }
  return (user.email || '').trim() || null;
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
    if (payload.exp && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

async function getServiceJwt(): Promise<string> {
  const base = apiBase();
  const username = (process.env.EXTERNAL_TICKET_ADMIN_USERNAME || '').trim();
  const password = (process.env.EXTERNAL_TICKET_ADMIN_PASSWORD || '').trim();
  if (!base || !username || !password) {
    throw new Error(
      'Dashboard CEAPDesk: defina EXTERNAL_TICKET_API_BASE_URL, EXTERNAL_TICKET_ADMIN_USERNAME e EXTERNAL_TICKET_ADMIN_PASSWORD',
    );
  }

  const now = Date.now();
  const skew = 60_000;
  if (cachedJwt && cachedJwt.expiresAtMs - skew > now) {
    return cachedJwt.token;
  }

  const url = `${base}/api/v1/users/login`;
  const res = await axios.post(
    url,
    { username, password },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs(),
      validateStatus: (s) => s >= 200 && s < 300,
    },
  );

  const token =
    typeof res.data === 'object' && res.data !== null && 'token' in res.data
      ? String((res.data as { token: unknown }).token || '').trim()
      : '';

  if (!token) {
    throw new Error('Dashboard CEAPDesk: login não retornou token JWT');
  }

  const expMs = decodeJwtExpMs(token);
  cachedJwt = {
    token,
    expiresAtMs: expMs ?? now + 50 * 60 * 1000,
  };

  return token;
}

function mergeQuery(
  query: Record<string, string | undefined>,
  viewer: DashboardViewer | undefined,
  usuarioScoped: string | null,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...query };
  if (viewer && viewer.role !== 'ADMIN' && usuarioScoped) {
    out.usuario = usuarioScoped;
  }
  return out;
}

function toSearchParams(q: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) {
      sp.set(k, String(v));
    }
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function getWithAuth(
  path: string,
  query: Record<string, string | undefined>,
  viewer?: DashboardViewer,
): Promise<unknown> {
  if (!isCeapdeskDashboardEnabled()) {
    throw new Error('Dashboard CEAPDesk desabilitado (EXTERNAL_TICKET_DASHBOARD_ENABLED)');
  }

  const base = apiBase();
  if (!base) {
    throw new Error('EXTERNAL_TICKET_API_BASE_URL não configurado');
  }

  let usuarioScoped: string | null = null;
  if (viewer && viewer.role !== 'ADMIN') {
    usuarioScoped = await resolveUsuarioFilter(viewer.id);
  }

  const q = mergeQuery(query, viewer, usuarioScoped);
  const jwt = await getServiceJwt();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}${toSearchParams(q)}`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    timeout: timeoutMs(),
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return res.data;
}

export async function fetchAnalyticsStats(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/analytics/stats', query, viewer);
}

export async function fetchDashboardCompleto(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/analytics/dashboard-completo', query, viewer);
}

export async function fetchProductivity(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/analytics/productivity', query, viewer);
}

export async function fetchUsuariosPerformance(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/analytics/usuarios-performance', query, viewer);
}

export async function fetchPerformanceSetores(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/analytics/performance-setores', query, viewer);
}

export async function fetchReportsStats(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/reports/stats', query, viewer);
}

export async function fetchReportsData(
  viewer: DashboardViewer,
  query: Record<string, string | undefined> = {},
): Promise<unknown> {
  return getWithAuth('/api/v1/reports/data', query, viewer);
}
