/** URLs CDN do WhatsApp são criptografadas — não abrem no navegador. */
export function isWhatsAppCdnUrl(url: string): boolean {
  return /mmg\.whatsapp\.net|whatsapp\.net|pps\.whatsapp/i.test(url);
}

/** Normaliza mediaKey (string base64, Buffer JSON ou objeto numérico da Evolution API). */
export function normalizeWhatsAppMediaKey(mediaKey: unknown): string | undefined {
  if (!mediaKey) return undefined;
  if (typeof mediaKey === 'string') return mediaKey;
  if (Buffer.isBuffer(mediaKey)) return mediaKey.toString('base64');
  if (mediaKey instanceof Uint8Array) return Buffer.from(mediaKey).toString('base64');

  if (typeof mediaKey === 'object' && mediaKey !== null) {
    const record = mediaKey as Record<string, unknown>;
    const buf = record as { type?: string; data?: number[] };
    if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
      return Buffer.from(buf.data).toString('base64');
    }

    // Evolution/Baileys: { "0": 188, "1": 200, ... }
    const numericKeys = Object.keys(record).filter((k) => /^\d+$/.test(k));
    if (numericKeys.length >= 16) {
      const bytes = numericKeys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => Number(record[k]) & 0xff);
      return Buffer.from(bytes).toString('base64');
    }
  }
  return undefined;
}

/** Extrai mediaKey/mimetype de image|video|audio|document no payload do webhook. */
export function extractEvolutionMediaFields(messagePart: Record<string, any> | null | undefined): {
  mediaKey?: string;
  mimetype?: string;
  fileLength?: unknown;
  fileName?: string;
  width?: unknown;
  height?: unknown;
  seconds?: unknown;
  ptt?: unknown;
} | null {
  if (!messagePart) return null;
  const mediaKey = normalizeWhatsAppMediaKey(messagePart.mediaKey);
  return {
    mediaKey,
    mimetype: messagePart.mimetype,
    fileLength: messagePart.fileLength,
    fileName: messagePart.fileName,
    width: messagePart.width,
    height: messagePart.height,
    seconds: messagePart.seconds,
    ptt: messagePart.ptt,
  };
}

/** Tenta obter mediaKey de mediaMetadata ou do message aninhado no metadata. */
export function resolveMediaKeyFromMetadata(metadata: Record<string, any> | null | undefined): string | undefined {
  if (!metadata) return undefined;
  const fromMeta = normalizeWhatsAppMediaKey(metadata?.mediaMetadata?.mediaKey);
  if (fromMeta) return fromMeta;

  const inner = metadata.message;
  if (!inner || typeof inner !== 'object') return undefined;
  const part =
    inner.imageMessage ||
    inner.videoMessage ||
    inner.audioMessage ||
    inner.documentMessage ||
    inner.stickerMessage;
  return normalizeWhatsAppMediaKey(part?.mediaKey);
}
export function buildEvolutionMediaMessagePayload(
  metadata: Record<string, any>,
  externalId?: string | null,
): Record<string, any> | null {
  if (metadata?.key && metadata?.message) {
    return { key: metadata.key, message: metadata.message };
  }

  if (metadata?.message?.key) {
    return metadata.message;
  }

  const key =
    metadata?.key ||
    (externalId
      ? {
          id: externalId,
          remoteJid: metadata?.remoteJid,
          fromMe: metadata?.fromMe ?? false,
        }
      : null);

  if (!key?.id) return null;

  const inner = metadata?.message;
  if (inner && typeof inner === 'object') {
    if (
      inner.imageMessage ||
      inner.videoMessage ||
      inner.audioMessage ||
      inner.documentMessage ||
      inner.stickerMessage
    ) {
      return { key, message: inner };
    }
  }

  const mediaTypes = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'stickerMessage',
  ] as const;
  for (const t of mediaTypes) {
    if (metadata[t]) {
      return { key, message: { [t]: metadata[t] } };
    }
  }

  return null;
}
