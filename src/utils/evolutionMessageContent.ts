import { extractEvolutionIncomingContent } from './evolutionInteractive';
import { extractEvolutionMediaFields } from './whatsappMedia';

export type EvolutionParsedMessageContent = {
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT';
  mediaUrl?: string | null;
  mediaMetadata?: ReturnType<typeof extractEvolutionMediaFields> | Record<string, unknown> | null;
};

export type EvolutionParsedMessage =
  | {
      skip: true;
      reason: string;
    }
  | ({ skip?: false } & EvolutionParsedMessageContent);

const MESSAGE_WRAPPER_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'editedMessage',
  'documentWithCaptionMessage',
] as const;

/** Tipos internos do Baileys que não são conteúdo conversacional. */
const SILENT_SKIP_KEYS = new Set([
  'senderKeyDistributionMessage',
  'protocolMessage',
  'messageContextInfo',
  'deviceSentMessage',
]);

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

/** Desembrulha ephemeral / view once / edited / documentWithCaption. */
export function unwrapEvolutionMessageObject(msgObj: unknown, depth = 0): Record<string, unknown> | null {
  if (!msgObj || typeof msgObj !== 'object' || depth > 6) {
    return (msgObj && typeof msgObj === 'object' ? msgObj : null) as Record<string, unknown> | null;
  }

  const obj = msgObj as Record<string, unknown>;
  for (const key of MESSAGE_WRAPPER_KEYS) {
    const wrapper = obj[key];
    if (wrapper && typeof wrapper === 'object' && (wrapper as Record<string, unknown>).message) {
      return unwrapEvolutionMessageObject((wrapper as Record<string, unknown>).message, depth + 1);
    }
  }

  return obj;
}

function formatLocationContent(part: Record<string, unknown>): string {
  const lat = part.degreesLatitude ?? part.latitude;
  const lng = part.degreesLongitude ?? part.longitude;
  const name = pickFirstString(part.name, part.address);
  const coords =
    lat != null && lng != null ? `${lat}, ${lng}` : '';
  if (name && coords) return `📍 ${name} (${coords})`;
  if (name) return `📍 ${name}`;
  if (coords) return `📍 ${coords}`;
  return '📍 Localização';
}

function formatContactContent(part: Record<string, unknown>): string {
  const name = pickFirstString(part.displayName, part.fn);
  if (name) return `👤 ${name}`;
  const vcard = typeof part.vcard === 'string' ? part.vcard : '';
  const fromVcard = vcard.split('\n').find((line) => line.startsWith('FN:'))?.slice(3).trim();
  if (fromVcard) return `👤 ${fromVcard}`;
  return '👤 Contato';
}

function formatReactionContent(part: Record<string, unknown>): string {
  const emoji = pickFirstString(part.text);
  return emoji ? `Reagiu com ${emoji}` : 'Reagiu à mensagem';
}

function parseMediaPart(
  part: Record<string, unknown>,
  type: EvolutionParsedMessageContent['messageType'],
  captionFields: string[] = ['caption'],
): EvolutionParsedMessageContent {
  let caption = '';
  for (const field of captionFields) {
    caption = pickFirstString(part[field]);
    if (caption) break;
  }
  return {
    content: caption,
    messageType: type,
    mediaUrl: pickFirstString(part.url) || null,
    mediaMetadata: extractEvolutionMediaFields(part as Record<string, any>),
  };
}

function parseByMessageTypeKey(
  msgObj: Record<string, unknown>,
  evolutionMessageType?: string,
): EvolutionParsedMessageContent | null {
  const key = String(evolutionMessageType || '').trim();
  if (!key) return null;
  const part = msgObj[key];
  if (!part || typeof part !== 'object') return null;
  const p = part as Record<string, unknown>;

  if (key === 'conversation') {
    return { content: pickFirstString(p), messageType: 'TEXT' };
  }
  if (key === 'extendedTextMessage') {
    return { content: pickFirstString(p.text), messageType: 'TEXT' };
  }
  if (key === 'imageMessage') return parseMediaPart(p, 'IMAGE');
  if (key === 'videoMessage') return parseMediaPart(p, 'VIDEO');
  if (key === 'audioMessage') return parseMediaPart(p, 'AUDIO');
  if (key === 'documentMessage') return parseMediaPart(p, 'DOCUMENT', ['caption', 'fileName']);
  if (key === 'stickerMessage') {
    const parsed = parseMediaPart(p, 'IMAGE');
    return { ...parsed, content: parsed.content || '[Figurinha]' };
  }
  if (key === 'ptvMessage') return parseMediaPart(p, 'VIDEO');
  if (key === 'locationMessage' || key === 'liveLocationMessage') {
    return { content: formatLocationContent(p), messageType: 'LOCATION' };
  }
  if (key === 'contactMessage' || key === 'contactsArrayMessage') {
    return { content: formatContactContent(p), messageType: 'CONTACT' };
  }
  if (key === 'reactionMessage') {
    return { content: formatReactionContent(p), messageType: 'TEXT' };
  }
  if (key === 'pollCreationMessage') {
    return {
      content: pickFirstString(p.name) || '[Enquete]',
      messageType: 'TEXT',
    };
  }
  if (key === 'pollUpdateMessage') {
    return { content: '[Resposta em enquete]', messageType: 'TEXT' };
  }
  if (key === 'buttonsMessage' || key === 'listMessage' || key === 'templateMessage') {
    const body =
      (p.hydratedContentText as Record<string, unknown> | undefined) ||
      (p.hydratedTemplate as Record<string, unknown> | undefined) ||
      p;
    return {
      content:
        pickFirstString(
          body.hydratedContentText,
          p.contentText,
          p.text,
          p.caption,
          p.description,
          p.title,
        ) || '[Mensagem interativa]',
      messageType: 'TEXT',
    };
  }
  if (key === 'interactiveMessage') {
    const body = (p.body as Record<string, unknown> | undefined) || p;
    return {
      content: pickFirstString(body?.text, p.text) || '[Mensagem interativa]',
      messageType: 'TEXT',
    };
  }
  if (key === 'orderMessage') {
    return {
      content: pickFirstString(p.orderTitle, p.message) || '[Pedido]',
      messageType: 'TEXT',
    };
  }
  if (key === 'productMessage') {
    const product =
      p.product && typeof p.product === 'object'
        ? (p.product as Record<string, unknown>)
        : null;
    return {
      content: pickFirstString(product?.title, p.title, p.body) || '[Produto]',
      messageType: 'TEXT',
    };
  }
  if (key === 'groupInviteMessage') {
    return {
      content: pickFirstString(p.groupName) || '[Convite para grupo]',
      messageType: 'TEXT',
    };
  }
  if (key === 'albumMessage') {
    return { content: '[Álbum de mídia]', messageType: 'TEXT' };
  }

  return null;
}

/**
 * Converte payload Evolution/Baileys em conteúdo do CRM.
 * Retorna { skip: true } para eventos que não devem virar mensagem (ex.: chaves de grupo).
 */
export function parseEvolutionMessageContent(
  rawMsgObj: unknown,
  envelope?: { messageType?: string; root?: unknown; body?: string },
): EvolutionParsedMessage {
  const unwrapped = unwrapEvolutionMessageObject(rawMsgObj);
  if (!unwrapped) {
    return { skip: true, reason: 'empty_message' };
  }

  const keys = Object.keys(unwrapped);
  const onlySilent = keys.length > 0 && keys.every((k) => SILENT_SKIP_KEYS.has(k));
  if (onlySilent) {
    return { skip: true, reason: keys[0] || 'silent' };
  }

  if (typeof unwrapped.conversation === 'string') {
    return { content: unwrapped.conversation, messageType: 'TEXT' };
  }

  const extended = unwrapped.extendedTextMessage;
  if (extended && typeof extended === 'object') {
    return {
      content: pickFirstString((extended as Record<string, unknown>).text),
      messageType: 'TEXT',
    };
  }

  if (envelope?.body) {
    return { content: String(envelope.body), messageType: 'TEXT' };
  }

  if (unwrapped.imageMessage && typeof unwrapped.imageMessage === 'object') {
    return parseMediaPart(unwrapped.imageMessage as Record<string, unknown>, 'IMAGE');
  }
  if (unwrapped.videoMessage && typeof unwrapped.videoMessage === 'object') {
    return parseMediaPart(unwrapped.videoMessage as Record<string, unknown>, 'VIDEO');
  }
  if (unwrapped.ptvMessage && typeof unwrapped.ptvMessage === 'object') {
    return parseMediaPart(unwrapped.ptvMessage as Record<string, unknown>, 'VIDEO');
  }
  if (unwrapped.audioMessage && typeof unwrapped.audioMessage === 'object') {
    return parseMediaPart(unwrapped.audioMessage as Record<string, unknown>, 'AUDIO');
  }
  if (unwrapped.documentMessage && typeof unwrapped.documentMessage === 'object') {
    return parseMediaPart(unwrapped.documentMessage as Record<string, unknown>, 'DOCUMENT', [
      'caption',
      'fileName',
    ]);
  }
  if (unwrapped.stickerMessage && typeof unwrapped.stickerMessage === 'object') {
    const parsed = parseMediaPart(unwrapped.stickerMessage as Record<string, unknown>, 'IMAGE');
    return { ...parsed, content: parsed.content || '[Figurinha]' };
  }
  if (unwrapped.locationMessage && typeof unwrapped.locationMessage === 'object') {
    return {
      content: formatLocationContent(unwrapped.locationMessage as Record<string, unknown>),
      messageType: 'LOCATION',
    };
  }
  if (unwrapped.liveLocationMessage && typeof unwrapped.liveLocationMessage === 'object') {
    return {
      content: formatLocationContent(unwrapped.liveLocationMessage as Record<string, unknown>),
      messageType: 'LOCATION',
    };
  }
  if (unwrapped.contactMessage && typeof unwrapped.contactMessage === 'object') {
    return {
      content: formatContactContent(unwrapped.contactMessage as Record<string, unknown>),
      messageType: 'CONTACT',
    };
  }
  if (unwrapped.contactsArrayMessage && typeof unwrapped.contactsArrayMessage === 'object') {
    return {
      content: formatContactContent(unwrapped.contactsArrayMessage as Record<string, unknown>),
      messageType: 'CONTACT',
    };
  }
  if (unwrapped.reactionMessage && typeof unwrapped.reactionMessage === 'object') {
    return {
      content: formatReactionContent(unwrapped.reactionMessage as Record<string, unknown>),
      messageType: 'TEXT',
    };
  }
  if (unwrapped.pollCreationMessage && typeof unwrapped.pollCreationMessage === 'object') {
    return {
      content:
        pickFirstString((unwrapped.pollCreationMessage as Record<string, unknown>).name) ||
        '[Enquete]',
      messageType: 'TEXT',
    };
  }
  if (unwrapped.pollUpdateMessage) {
    return { content: '[Resposta em enquete]', messageType: 'TEXT' };
  }

  const interactiveIncoming = extractEvolutionIncomingContent(unwrapped, {
    messageType: envelope?.messageType,
    root: envelope?.root,
  });
  if (interactiveIncoming) {
    return {
      content: interactiveIncoming.displayText,
      messageType: 'TEXT',
      mediaMetadata: {
        evolutionInteractiveReply: interactiveIncoming.interactive,
        botInputId: interactiveIncoming.content,
      },
    };
  }

  const fromTypeKey = parseByMessageTypeKey(unwrapped, envelope?.messageType);
  if (fromTypeKey) return fromTypeKey;

  for (const key of keys) {
    if (SILENT_SKIP_KEYS.has(key)) continue;
    const byKey = parseByMessageTypeKey(unwrapped, key);
    if (byKey) return byKey;
  }

  return {
    content: '[Mensagem não suportada]',
    messageType: 'TEXT',
  };
}
