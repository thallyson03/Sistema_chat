/** Eventos Evolution registrados no webhook do CRM. */
export const EVOLUTION_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_EDITED',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED',
  'PRESENCE_UPDATE',
] as const;

export type EvolutionPresenceState =
  | 'composing'
  | 'recording'
  | 'available'
  | 'unavailable'
  | 'paused';

export function extractEvolutionEventType(event: any): string {
  return String(
    event?.event ||
      event?.eventName ||
      event?.eventType ||
      event?.data?.event ||
      event?.data?.eventName ||
      '',
  ).trim();
}

export function extractEvolutionInstanceName(event: any, eventData?: any): string | null {
  const data = eventData ?? event?.data ?? event;
  const name =
    event?.instance ||
    event?.instanceName ||
    data?.instance ||
    data?.instanceName ||
    null;
  return name ? String(name) : null;
}

/** Mapeia status ACK do Baileys/Evolution para MessageStatus do CRM. */
export function mapEvolutionAckToMessageStatus(
  raw: unknown,
): 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null {
  if (raw === null || raw === undefined) return null;

  const normalized = String(raw).toLowerCase();

  if (['error', 'failed', '0'].includes(normalized)) return 'FAILED';
  if (['pending', '1'].includes(normalized)) return 'PENDING';
  if (['sent', 'server_ack', 'serverack', '2'].includes(normalized)) return 'SENT';
  if (['delivery_ack', 'deliveryack', 'delivered', '3'].includes(normalized)) return 'DELIVERED';
  if (['read', 'read_ack', 'readack', 'played', '4', '5'].includes(normalized)) return 'READ';

  const num = Number(raw);
  if (Number.isFinite(num)) {
    if (num === 0) return 'FAILED';
    if (num === 1) return 'PENDING';
    if (num === 2) return 'SENT';
    if (num === 3) return 'DELIVERED';
    if (num === 4 || num === 5) return 'READ';
  }

  return null;
}

export function extractPhoneFromEvolutionJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null;
  if (jid.includes('@g.us')) return null;
  let normalized = jid;
  if (jid.includes('@lid')) return null;
  normalized = normalized
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .trim();
  const clean = normalized.replace(/\D/g, '');
  return clean.length >= 10 ? clean : null;
}

export function extractEvolutionMessageKeyId(key: any): string | null {
  const id = key?.id ?? key?.messageId;
  return id ? String(id) : null;
}

/** Normaliza MESSAGES_UPDATE / MESSAGES_EDITED / SEND_MESSAGE para lista de patches. */
export function parseEvolutionMessagePatches(eventData: any): Array<{
  externalId: string;
  status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  content?: string;
  fromMe?: boolean;
  remoteJid?: string;
}> {
  const patches: Array<{
    externalId: string;
    status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    content?: string;
    fromMe?: boolean;
    remoteJid?: string;
  }> = [];

  const rows = Array.isArray(eventData)
    ? eventData
    : Array.isArray(eventData?.messages)
      ? eventData.messages
      : eventData?.key || eventData?.update || eventData?.message
        ? [eventData]
        : [];

  for (const row of rows) {
    const key = row?.key ?? row?.message?.key ?? eventData?.key;
    const externalId = extractEvolutionMessageKeyId(key);
    if (!externalId) continue;

    const update = row?.update ?? row;
    const statusRaw =
      update?.status ??
      update?.messageStatus ??
      row?.status ??
      row?.messageStatus;

    const status = mapEvolutionAckToMessageStatus(statusRaw) ?? undefined;

    let content: string | undefined;
    const edited =
      update?.message?.editedMessage ??
      update?.editedMessage ??
      row?.message?.editedMessage;
    if (edited) {
      content =
        edited?.conversation ||
        edited?.extendedTextMessage?.text ||
        edited?.imageMessage?.caption ||
        undefined;
      if (content) content = String(content);
    }

    const fromMe =
      key?.fromMe === true ||
      key?.fromMe === 'true' ||
      key?.fromMe === 1 ||
      key?.fromMe === '1';

    patches.push({
      externalId,
      status,
      content,
      fromMe,
      remoteJid: key?.remoteJid ? String(key.remoteJid) : undefined,
    });
  }

  return patches;
}

const VALID_PRESENCE_STATES = new Set<EvolutionPresenceState>([
  'composing',
  'recording',
  'available',
  'unavailable',
  'paused',
]);

function normalizePresenceState(raw: unknown): EvolutionPresenceState | null {
  if (raw === null || raw === undefined) return null;
  const state = String(raw).toLowerCase() as EvolutionPresenceState;
  return VALID_PRESENCE_STATES.has(state) ? state : null;
}

function readPresenceStateFromEntry(entry: any): EvolutionPresenceState | null {
  if (!entry || typeof entry !== 'object') return null;
  return (
    normalizePresenceState(entry.lastKnownPresence) ||
    normalizePresenceState(entry.presence) ||
    normalizePresenceState(entry.last)
  );
}

function isWhatsAppPhoneJid(jid: string): boolean {
  return jid.includes('@s.whatsapp.net') || jid.includes('@c.us');
}

function collectPresenceJidCandidates(eventData: any): string[] {
  const presences = eventData?.presences || eventData?.presence;
  const keys =
    presences && typeof presences === 'object' && !Array.isArray(presences)
      ? Object.keys(presences)
      : [];

  const candidates = [
    eventData?.id,
    eventData?.remoteJid,
    eventData?.remoteJidAlt,
    eventData?.senderPn,
    eventData?.participant,
    ...keys,
  ];

  const unique: string[] = [];
  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const jid = value.trim();
    if (!unique.includes(jid)) unique.push(jid);
  }
  return unique;
}

export function parseEvolutionPresence(eventData: any): {
  remoteJid: string;
  state: EvolutionPresenceState;
} | null {
  if (!eventData || typeof eventData !== 'object') return null;

  const presences = eventData?.presences || eventData?.presence || {};
  const candidates = collectPresenceJidCandidates(eventData);

  let fallback: { remoteJid: string; state: EvolutionPresenceState } | null = null;

  const consider = (jid: string, state: EvolutionPresenceState) => {
    if (isWhatsAppPhoneJid(jid) && (state === 'composing' || state === 'recording')) {
      return { remoteJid: jid, state };
    }
    if (!fallback) fallback = { remoteJid: jid, state };
    return null;
  };

  for (const jid of candidates) {
    if (jid.includes('@g.us')) continue;

    const entry =
      (presences && typeof presences === 'object' && presences[jid]) ||
      (jid === eventData?.id || jid === eventData?.remoteJid ? eventData : null);

    const state =
      readPresenceStateFromEntry(entry) ||
      (jid === eventData?.id || jid === eventData?.remoteJid
        ? normalizePresenceState(eventData?.lastKnownPresence) ||
          normalizePresenceState(eventData?.presence)
        : null);

    if (!state) continue;

    const immediate = consider(jid, state);
    if (immediate) return immediate;
  }

  const rootState =
    normalizePresenceState(eventData?.lastKnownPresence) ||
    normalizePresenceState(eventData?.presence);
  if (rootState && candidates[0]) {
    const immediate = consider(candidates[0], rootState);
    if (immediate) return immediate;
  }

  return fallback;
}

/** Extrai telefone E.164 a partir do payload de presença (inclui fallback LID → senderPn). */
export function extractPhoneFromEvolutionPresenceData(eventData: any): string | null {
  if (!eventData || typeof eventData !== 'object') return null;

  const candidates = collectPresenceJidCandidates(eventData);
  const senderPn =
    typeof eventData?.senderPn === 'string'
      ? eventData.senderPn
      : typeof eventData?.participant === 'string'
        ? eventData.participant
        : null;

  for (const jid of candidates) {
    if (jid.includes('@g.us')) continue;
    if (jid.includes('@lid')) {
      if (senderPn) {
        const fromSender = extractPhoneFromEvolutionJid(senderPn);
        if (fromSender) return fromSender;
      }
      continue;
    }
    const phone = extractPhoneFromEvolutionJid(jid);
    if (phone) return phone;
  }

  if (senderPn) {
    return extractPhoneFromEvolutionJid(senderPn);
  }

  return null;
}

export function extractEvolutionQrBase64(eventData: any): string | null {
  const raw =
    eventData?.qrcode?.base64 ??
    eventData?.qrcode ??
    eventData?.base64 ??
    eventData?.data?.qrcode?.base64 ??
    null;

  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('data:image')) return raw;
  const clean = raw.replace(/^data:image\/[a-z]+;base64,/, '');
  return `data:image/png;base64,${clean}`;
}
