/** URLs CDN do WhatsApp são criptografadas — não abrem no navegador. */
export function isWhatsAppCdnUrl(url: string): boolean {
  return /mmg\.whatsapp\.net|whatsapp\.net|pps\.whatsapp/i.test(url);
}

/** Normaliza mediaKey (string base64 ou Buffer serializado no JSON do webhook). */
export function normalizeWhatsAppMediaKey(mediaKey: unknown): string | undefined {
  if (!mediaKey) return undefined;
  if (typeof mediaKey === 'string') return mediaKey;
  if (typeof mediaKey === 'object' && mediaKey !== null) {
    const buf = mediaKey as { type?: string; data?: number[] };
    if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
      return Buffer.from(buf.data).toString('base64');
    }
  }
  return undefined;
}

/** Monta payload para POST /chat/getBase64FromMediaMessage/{instance}. */
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
