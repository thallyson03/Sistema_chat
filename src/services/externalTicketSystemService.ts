import axios from 'axios';
import * as crypto from 'crypto';
import prisma from '../config/database';

function isEnabled(): boolean {
  const v = process.env.EXTERNAL_TICKET_ENABLED;
  return v === '1' || v === 'true' || v === 'yes';
}

/** Integração com CEAPDesk / tickets externos ligada (variável de ambiente). */
export function isExternalTicketEnabled(): boolean {
  return isEnabled();
}

function apiBase(): string | null {
  const raw = (process.env.EXTERNAL_TICKET_API_BASE_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}

function portalBase(): string | null {
  const raw = (process.env.EXTERNAL_TICKET_PORTAL_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}

function externalOrigin(): string | null {
  const prefer = portalBase() || apiBase();
  if (!prefer) return null;
  try {
    return new URL(prefer).origin;
  } catch {
    return null;
  }
}

function toAbsoluteExternalUrl(rawUrl: string): string {
  const url = (rawUrl || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = externalOrigin();
  if (!origin) return url;
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`;
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

function ssoRedirectQueryParam(): string {
  const raw = (process.env.EXTERNAL_TICKET_SSO_REDIRECT_QUERY_PARAM || 'ticketAccessToken').trim();
  return raw || 'ticketAccessToken';
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

function sectorCreatePath(): string {
  const p = (process.env.EXTERNAL_TICKET_SECTOR_CREATE_PATH || '/api/v1/setores').trim();
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

/** JSON extra mesclado só quando o usuário local é ADMIN (ex.: flags de analytics no CEAPDesk). */
function parseAdminExtraBody(): Record<string, unknown> {
  const raw = (process.env.EXTERNAL_TICKET_CREATE_ADMIN_BODY_EXTRA || '').trim();
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    console.warn('[ExternalTicket] EXTERNAL_TICKET_CREATE_ADMIN_BODY_EXTRA inválido (JSON), ignorando.');
    return {};
  }
}

function normalizeUsername(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function roleToExternal(role: string | null | undefined): 'admin' | 'user' {
  if (role === 'ADMIN') return 'admin';
  return 'user';
}

function shouldSendDynamicUserMap(): boolean {
  const raw = (process.env.EXTERNAL_TICKET_DYNAMIC_USER_MAP || 'true').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'no';
}

function defaultExternalSector(): string | null {
  const raw = (process.env.EXTERNAL_TICKET_DEFAULT_SECTOR || '').trim();
  return raw || null;
}

function sendLocalSectorIdsToExternal(): boolean {
  const raw = (process.env.EXTERNAL_TICKET_SEND_LOCAL_SECTOR_IDS || 'false').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function syncSectorsOnUserCreateEnabled(): boolean {
  const raw = (process.env.EXTERNAL_TICKET_SYNC_SECTORS_ON_USER_CREATE || 'true').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'no';
}

function appendSsoTokenIfNeeded(redirectUrl: string, token: string | null | undefined): string {
  const url = (redirectUrl || '').trim();
  if (!url) return url;
  try {
    const baseForRelative = externalOrigin() || 'http://localhost';
    const u = new URL(url, baseForRelative);
    const qp = ssoRedirectQueryParam();
    const directToken = (token || '').trim();
    const discoveredToken =
      directToken ||
      u.searchParams.get(qp) ||
      u.searchParams.get('ticketAccessToken') ||
      u.searchParams.get('accessToken') ||
      u.searchParams.get('access_token') ||
      u.searchParams.get('token') ||
      '';
    const tk = discoveredToken.trim();
    if (!tk) return url;

    // Param principal configurado
    if (!u.searchParams.get(qp)) u.searchParams.set(qp, tk);
    // Aliases para compatibilidade com páginas legadas do sistema externo
    if (!u.searchParams.get('ticketAccessToken')) u.searchParams.set('ticketAccessToken', tk);
    if (!u.searchParams.get('accessToken')) u.searchParams.set('accessToken', tk);
    if (!u.searchParams.get('token')) u.searchParams.set('token', tk);

    // Se a URL original era relativa, devolve relativa para o normalizador torná-la absoluta externa.
    if (!/^https?:\/\//i.test(url)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    return url;
  }
}

function extractSsoRedirectUrl(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const candidates = [data.redirectUrl, data.url, data.redirect_url, data.redirect];
  for (const c of candidates) {
    const v = (c || '').toString().trim();
    if (v) return v;
  }
  return '';
}

function extractSsoAccessToken(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const candidates = [
    data.ticketAccessToken,
    data.ticket_access_token,
    data.accessToken,
    data.access_token,
    data.token,
  ];
  for (const c of candidates) {
    const v = (c || '').toString().trim();
    if (v) return v;
  }
  return '';
}

type ExternalAuthScope = 'user_create' | 'sector_create';

function cleanEnvValue(raw: string): string {
  const v = (raw || '').trim();
  // Remove aspas acidentais comuns em variáveis de ambiente.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function stripAuthPrefix(token: string): string {
  return token.replace(/^(bearer|token)\s+/i, '').trim();
}

function scopedToken(scope: ExternalAuthScope): string {
  if (scope === 'user_create') {
    return (
      cleanEnvValue(process.env.EXTERNAL_TICKET_USER_API_TOKEN || '') ||
      cleanEnvValue(process.env.EXTERNAL_TICKET_API_TOKEN || '')
    );
  }
  return (
    cleanEnvValue(process.env.EXTERNAL_TICKET_SECTOR_API_TOKEN || '') ||
    cleanEnvValue(process.env.EXTERNAL_TICKET_API_TOKEN || '')
  );
}

function scopedHeaderName(scope: ExternalAuthScope): string {
  if (scope === 'user_create') {
    return (
      cleanEnvValue(process.env.EXTERNAL_TICKET_USER_API_KEY_HEADER || '') ||
      cleanEnvValue(process.env.EXTERNAL_TICKET_API_KEY_HEADER || '')
    );
  }
  return (
    cleanEnvValue(process.env.EXTERNAL_TICKET_SECTOR_API_KEY_HEADER || '') ||
    cleanEnvValue(process.env.EXTERNAL_TICKET_API_KEY_HEADER || '')
  );
}

function scopedAuthScheme(scope: ExternalAuthScope): string {
  if (scope === 'user_create') {
    return (
      cleanEnvValue(process.env.EXTERNAL_TICKET_USER_API_TOKEN_SCHEME || '') ||
      cleanEnvValue(process.env.EXTERNAL_TICKET_API_TOKEN_SCHEME || '') ||
      'Bearer'
    );
  }
  return (
    cleanEnvValue(process.env.EXTERNAL_TICKET_SECTOR_API_TOKEN_SCHEME || '') ||
    cleanEnvValue(process.env.EXTERNAL_TICKET_API_TOKEN_SCHEME || '') ||
    'Bearer'
  );
}

function authHeaders(scope: ExternalAuthScope): Record<string, string> {
  const token = scopedToken(scope);
  const headerName = scopedHeaderName(scope);
  const scheme = scopedAuthScheme(scope);

  if (!token) return {};

  // Quando header customizado é informado, envia o token cru no header escolhido.
  if (headerName) {
    return { [headerName]: stripAuthPrefix(token) };
  }

  // Para casos em que Authorization não usa "Bearer".
  if (scheme.toLowerCase() === 'none') {
    return { Authorization: stripAuthPrefix(token) };
  }
  return { Authorization: `${scheme} ${stripAuthPrefix(token)}` };
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

function extractRemoteSectorId(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidates = [
    d.id,
    d.sectorId,
    d.setorId,
    (d.sector as Record<string, unknown> | undefined)?.id,
    (d.setor as Record<string, unknown> | undefined)?.id,
    (d.data as Record<string, unknown> | undefined)?.id,
    (d.result as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isInteger(c) && c >= 1) return c;
    if (typeof c === 'string' && /^\d+$/.test(c.trim())) return Number(c.trim());
  }
  return null;
}

export interface CreateRemoteTicketUserInput {
  localUserId: string;
  email: string;
  name: string;
  /** Se omitido ou vazio, a senha não é enviada no corpo (re-sync após edição). */
  plainPassword?: string;
}

export interface CreateRemoteTicketSectorInput {
  localSectorId: string;
  name: string;
  description?: string | null;
}

/**
 * Cria usuário no sistema externo de tickets e persiste ticketSystemUserId no User.
 * Respeita EXTERNAL_TICKET_ENABLED. Falhas são logadas; erro opcional em ticketSystemSyncError.
 */
export async function syncUserToExternalTicketSystem(input: CreateRemoteTicketUserInput): Promise<void> {
  if (!isEnabled()) return;

  const base = apiBase();
  const headers = authHeaders('user_create');
  const tokenConfigured = scopedToken('user_create').length > 0;
  if (!base || !tokenConfigured) {
    const msg =
      'EXTERNAL_TICKET_API_BASE_URL e token de criação de usuário não configurados (EXTERNAL_TICKET_USER_API_TOKEN/EXTERNAL_TICKET_API_TOKEN)';
    console.error('[ExternalTicket]', msg);
    await prisma.user.update({
      where: { id: input.localUserId },
      data: { ticketSystemSyncError: msg },
    });
    return;
  }

  const url = `${base}${createPath()}`;
  const localUser = await prisma.user.findUnique({
    where: { id: input.localUserId },
    include: {
      sectors: {
        include: {
          sector: true,
        },
      },
      pipelineAccesses: {
        include: {
          pipeline: true,
        },
      },
      channelAccesses: {
        include: {
          channel: true,
        },
      },
    },
  });
  const firstSectorName = localUser?.sectors?.[0]?.sector?.name?.trim() || null;
  const firstSectorId = localUser?.sectors?.[0]?.sector?.id || null;
  const fallbackSectorName = defaultExternalSector();
  const resolvedSectorName = firstSectorName || fallbackSectorName;
  const sectorsData = (localUser?.sectors || [])
    .map((s) => ({
      id: s.sector?.id,
      name: s.sector?.name?.trim(),
      remoteId: s.sector?.ticketSystemSectorId ?? null,
    }))
    .filter((s): s is { id: string; name: string; remoteId: number | null } => !!s.id && !!s.name);
  const sectorNames = sectorsData.map((s) => s.name);
  const sectorIds = sectorsData.map((s) => s.id);

  const pipelineRows = (localUser?.pipelineAccesses || [])
    .map((a) => ({
      id: a.pipeline?.id,
      name: a.pipeline?.name?.trim(),
    }))
    .filter((p): p is { id: string; name: string } => !!p.id && !!p.name);
  const pipelineIds = pipelineRows.map((p) => p.id);
  const pipelineNames = pipelineRows.map((p) => p.name);

  const channelRows = (localUser?.channelAccesses || [])
    .map((a) => ({
      id: a.channel?.id,
      name: a.channel?.name?.trim(),
    }))
    .filter((c): c is { id: string; name: string } => !!c.id && !!c.name);
  const channelIds = channelRows.map((c) => c.id);
  const channelNames = channelRows.map((c) => c.name);

  const safeEmail = (localUser?.email || input.email || '').trim();
  const safeName = (localUser?.name || input.name || '').trim();
  const roleRaw = localUser?.role || 'AGENT';
  const usernameFromEmail = safeEmail.includes('@') ? safeEmail.split('@')[0] : safeEmail;
  const usernameBase = normalizeUsername(usernameFromEmail || safeName || `user_${input.localUserId.slice(0, 8)}`);

  // Reduz falhas de criação de usuário quando o sistema externo exige setor pré-cadastrado.
  const remoteSectorIds = sectorsData
    .map((s) => s.remoteId)
    .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 1);

  if (syncSectorsOnUserCreateEnabled() && sectorsData.length > 0) {
    for (const sector of sectorsData) {
      const remoteId = await syncSectorToExternalTicketSystem({
        localSectorId: sector.id,
        name: sector.name,
      });
      if (typeof remoteId === 'number' && Number.isInteger(remoteId) && remoteId >= 1 && !remoteSectorIds.includes(remoteId)) {
        remoteSectorIds.push(remoteId);
      }
    }
  }

  const body: Record<string, unknown> = {
    email: safeEmail,
    name: safeName,
  };

  if (shouldSendDynamicUserMap()) {
    const roleMapped = roleToExternal(roleRaw);
    body.username = usernameBase || `user_${Date.now()}`;
    body.role = roleMapped;
    body.cargo = roleMapped.toUpperCase();
    body.active = localUser?.isActive ?? true;
    if (resolvedSectorName) {
      body.setor = resolvedSectorName;
      body.sector = resolvedSectorName;
      body.setorNome = resolvedSectorName;
      body.sectorName = resolvedSectorName;
    }
    // Por padrão, NÃO envia IDs locais de setor para evitar incompatibilidade com IDs remotos.
    if (sendLocalSectorIdsToExternal() && firstSectorId) {
      body.setorId = firstSectorId;
      body.sectorId = firstSectorId;
    }
    if (sectorNames.length > 0) {
      body.setores = sectorNames;
      body.setoresNomes = sectorNames;
      body.sectorNames = sectorNames;
    }
    if (remoteSectorIds.length > 0) {
      body.setorIds = remoteSectorIds;
      body.sectorIds = remoteSectorIds;
    }
    if (sendLocalSectorIdsToExternal() && sectorIds.length > 0) {
      body.localSetorIds = sectorIds;
      body.localSectorIds = sectorIds;
    }
    if (pipelineIds.length > 0) {
      body.pipelineIds = pipelineIds;
      body.pipelines = pipelineNames;
      body.pipelineNames = pipelineNames;
    }
    if (channelIds.length > 0) {
      body.channelIds = channelIds;
      body.canais = channelNames;
      body.channels = channelNames;
      body.channelNames = channelNames;
    }
  }

  // Metadados de integração com informações de setor para auditoria/depuração no sistema externo.
  body.metadata = {
    ...(typeof body.metadata === 'object' && body.metadata !== null ? (body.metadata as Record<string, unknown>) : {}),
    source: 'sistema_chat',
    localUserId: input.localUserId,
    localRole: roleRaw,
    localSectorId: firstSectorId,
    localSectorName: resolvedSectorName,
    localSectorIds: sectorIds,
    localSectorNames: sectorNames,
    remoteSectorIds,
    localPipelineIds: pipelineIds,
    localPipelineNames: pipelineNames,
    localChannelIds: channelIds,
    localChannelNames: channelNames,
  };

  // Campos fixos opcionais via env (sobrescrevem os dinâmicos se houver conflito)
  Object.assign(body, parseExtraBody());
  if (roleRaw === 'ADMIN') {
    Object.assign(body, parseAdminExtraBody());
  }

  const fromExtra =
    body.permissoes && typeof body.permissoes === 'object' && body.permissoes !== null
      ? (body.permissoes as Record<string, unknown>)
      : {};

  /** Indica ao CEAPDesk que o admin deve poder usar analytics/reports (ajuste fino via EXTERNAL_TICKET_CREATE_ADMIN_BODY_EXTRA). */
  const adminDashboardHint =
    roleRaw === 'ADMIN'
      ? {
          analytics: true,
          reports: true,
          dashboard: true,
          acessoAnalytics: true,
          acessoRelatorios: true,
          acessoDashboard: true,
        }
      : {};

  /** Snapshot de permissões locais (merge com EXTERNAL_TICKET_CREATE_BODY_EXTRA.permissoes se houver). */
  body.permissoes = {
    ...fromExtra,
    ...adminDashboardHint,
    roleLocal: roleRaw,
    roleExterno: roleToExternal(roleRaw),
    setores: sectorNames,
    setorIdsRemotos: remoteSectorIds,
    pipelineIds,
    pipelines: pipelineNames,
    channelIds,
    canais: channelNames,
  };

  if (roleRaw === 'ADMIN') {
    if (shouldSendDynamicUserMap()) {
      body.acessoAnalytics = true;
      body.acessoRelatorios = true;
    }
    if (typeof body.metadata === 'object' && body.metadata !== null) {
      (body.metadata as Record<string, unknown>).expectDashboardApiAccess = true;
    }
  }
  if (sendPasswordInCreate() && input.plainPassword) {
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

/**
 * Cria setor no sistema externo de tickets quando um novo setor é criado no Sistema_chat.
 * Best-effort: falhas são apenas logadas e não impedem o cadastro local.
 */
export async function syncSectorToExternalTicketSystem(input: CreateRemoteTicketSectorInput): Promise<number | null> {
  if (!isEnabled()) return null;

  const base = apiBase();
  const headers = authHeaders('sector_create');
  const tokenConfigured = scopedToken('sector_create').length > 0;
  if (!base || !tokenConfigured) {
    console.error(
      '[ExternalTicket] EXTERNAL_TICKET_API_BASE_URL e token de criação de setor não configurados; ignorando criação de setor externo.',
    );
    return null;
  }

  const url = `${base}${sectorCreatePath()}`;
  const body: Record<string, unknown> = {
    nome: input.name,
  };
  if (input.description) {
    body.descricao = input.description;
  }
  // Correlação estável entre setor local e remoto
  body.externalSectorId = input.localSectorId;
  body.localSectorId = input.localSectorId;
  body.metadata = {
    source: 'sistema_chat',
    localSectorId: input.localSectorId,
    localSectorName: input.name,
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: Number(process.env.EXTERNAL_TICKET_API_TIMEOUT_MS || '20000') || 20000,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    const remoteSectorId = extractRemoteSectorId(res.data);
    if (typeof remoteSectorId === 'number' && Number.isInteger(remoteSectorId) && remoteSectorId >= 1) {
      await prisma.sector.update({
        where: { id: input.localSectorId },
        data: { ticketSystemSectorId: remoteSectorId },
      });
    }
    console.log('[ExternalTicket] Setor sincronizado:', input.name, '->', url);
    return remoteSectorId;
  } catch (err: unknown) {
    const ax = axios.isAxiosError(err);
    const status = ax ? err.response?.status : undefined;
    const responseText = ax ? JSON.stringify(err.response?.data || '') : '';
    // Idempotência prática: setor já existente no externo não deve quebrar o fluxo.
    if (status === 400 && /ja existe|já existe/i.test(responseText)) {
      console.log('[ExternalTicket] Setor já existente no externo, seguindo fluxo:', input.name);
      return null;
    }
    const msg = ax
      ? `${status || '?'}` +
        (err.response?.data ? ` ${JSON.stringify(err.response.data).slice(0, 500)}` : ` ${err.message}`)
      : err instanceof Error
        ? err.message
        : String(err);
    console.error('[ExternalTicket] Falha ao criar setor remoto:', msg);
    return null;
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
      const ssoUrl = `${base}${ssoExchangePath()}`;
      const attempts: Array<{ kind: 'externalUserId' | 'email'; value: string }> = [];
      const remoteId = (user.ticketSystemUserId || '').trim();
      const email = (user.email || '').trim();
      if (remoteId) attempts.push({ kind: 'externalUserId', value: remoteId });
      if (email && (!remoteId || remoteId !== email)) attempts.push({ kind: 'email', value: email });

      for (const attempt of attempts) {
        const nonce = crypto.randomUUID();
        const exp = Math.floor(Date.now() / 1000) + ssoExpSeconds();
        const signature = crypto
          .createHmac('sha256', secret)
          .update(`${attempt.value}|${nonce}|${exp}`)
          .digest('hex');
        const body: Record<string, unknown> = {
          nonce,
          exp,
          signature,
          ...(attempt.kind === 'externalUserId'
            ? { externalUserId: attempt.value }
            : { email: attempt.value }),
        };
        try {
          const res = await axios.post(ssoUrl, body, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: Number(process.env.EXTERNAL_TICKET_API_TIMEOUT_MS || '20000') || 20000,
            validateStatus: (s) => s >= 200 && s < 300,
          });
          const responseObj =
            typeof res.data === 'object' && res.data !== null
              ? (res.data as Record<string, unknown>)
              : undefined;
          const redirectFromApi = extractSsoRedirectUrl(responseObj);
          const tokenFromApi = extractSsoAccessToken(responseObj);
          const redirectRaw = appendSsoTokenIfNeeded(redirectFromApi, tokenFromApi);
          const redirectUrl = toAbsoluteExternalUrl(redirectRaw);
          console.log('[ExternalTicket] SSO exchange retornou:', {
            hasRedirect: !!redirectFromApi,
            hasToken: !!tokenFromApi,
            redirectPreview: redirectFromApi ? `${redirectFromApi.slice(0, 120)}...` : null,
          });
          if (redirectUrl) {
            const qp = ssoRedirectQueryParam();
            if (!redirectUrl.includes(`${qp}=`)) {
              console.warn(
                `[ExternalTicket] Redirect SSO sem ${qp}; sistema externo pode abrir login.`,
              );
            }
            return redirectUrl;
          }
          console.error('[ExternalTicket] SSO exchange sem redirectUrl válido:', res.data);
        } catch (err: unknown) {
          const isAxios = axios.isAxiosError(err);
          const status = isAxios ? err.response?.status : undefined;
          const msg = isAxios
            ? `${status || '?'} ${JSON.stringify(err.response?.data || err.message).slice(0, 500)}`
            : err instanceof Error
              ? err.message
              : String(err);
          // Se 404 com externalUserId, tenta fallback por email automaticamente.
          if (status === 404 && attempt.kind === 'externalUserId' && email) {
            console.warn('[ExternalTicket] SSO exchange não encontrou externalUserId; tentando por email.');
            continue;
          }
          console.error('[ExternalTicket] Falha no SSO exchange:', msg);
          break;
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
  console.warn('[ExternalTicket] Usando fallback de portal sem SSO exchange bem-sucedido.');
  return `${portal}${suffix}`;
}

export function isTicketPortalConfigured(): boolean {
  const hasSso = !!apiBase() && !!ssoSharedSecret();
  return hasSso || !!portalBase();
}
