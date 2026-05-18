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

export function parseEvolutionPresence(eventData: any): {
  remoteJid: string;
  state: EvolutionPresenceState;
} | null {
  const id = eventData?.id || eventData?.remoteJid;
  if (!id) return null;

  const presences = eventData?.presences || eventData?.presence || {};
  const entry =
    presences[id] ||
    presences[Object.keys(presences)[0]] ||
    eventData;

  const last =
    entry?.lastKnownPresence ||
    entry?.presence ||
    eventData?.lastKnownPresence ||
    eventData?.presence;

  if (!last) return null;

  const state = String(last).toLowerCase() as EvolutionPresenceState;
  if (!['composing', 'recording', 'available', 'unavailable', 'paused'].includes(state)) {
    return null;
  }

  return { remoteJid: String(id), state };
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
