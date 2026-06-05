/** Janela de atendimento ao cliente da Meta (WhatsApp Cloud API): 24 horas após última mensagem do cliente. */
export const META_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MessagingWindowStatus {
  /** Regra da Meta se aplica (canal WhatsApp Official). */
  applies: boolean;
  /** Cliente respondeu dentro das últimas 24h — mensagens livres permitidas. */
  isOpen: boolean;
  expiresAt: string | null;
  remainingMs: number;
  lastCustomerMessageAt: string | null;
}

export class MessagingWindowClosedError extends Error {
  readonly code = 'MESSAGING_WINDOW_CLOSED';

  constructor(public readonly messagingWindow: MessagingWindowStatus) {
    super(
      'A janela de 24 horas expirou. Para falar com o cliente, envie um template aprovado pela Meta.',
    );
    this.name = 'MessagingWindowClosedError';
  }
}

export function isWhatsAppOfficialChannel(
  channel?: { type?: string; config?: unknown } | null,
): boolean {
  if (!channel || channel.type !== 'WHATSAPP') return false;
  const config = (channel.config || {}) as Record<string, unknown>;
  return (
    config.provider === 'whatsapp_official' &&
    !!config.phoneNumberId &&
    !!config.token
  );
}

export function getMessagingWindowStatus(
  lastCustomerMessageAt: Date | string | null | undefined,
  applies: boolean,
): MessagingWindowStatus {
  if (!applies) {
    return {
      applies: false,
      isOpen: true,
      expiresAt: null,
      remainingMs: 0,
      lastCustomerMessageAt: null,
    };
  }

  const lastAt = lastCustomerMessageAt ? new Date(lastCustomerMessageAt) : null;
  const lastIso =
    lastAt && !Number.isNaN(lastAt.getTime()) ? lastAt.toISOString() : null;

  if (!lastAt || Number.isNaN(lastAt.getTime())) {
    return {
      applies: true,
      isOpen: false,
      expiresAt: null,
      remainingMs: 0,
      lastCustomerMessageAt: null,
    };
  }

  const expiresAt = new Date(lastAt.getTime() + META_MESSAGING_WINDOW_MS);
  const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());

  return {
    applies: true,
    isOpen: remainingMs > 0,
    expiresAt: expiresAt.toISOString(),
    remainingMs,
    lastCustomerMessageAt: lastIso,
  };
}

export function getConversationMessagingWindow(conversation: {
  lastCustomerMessageAt?: Date | string | null;
  channel?: { type?: string; config?: unknown } | null;
}): MessagingWindowStatus {
  const applies = isWhatsAppOfficialChannel(conversation.channel);
  return getMessagingWindowStatus(conversation.lastCustomerMessageAt, applies);
}

export function assertMessagingWindowOpen(
  conversation: {
    lastCustomerMessageAt?: Date | string | null;
    channel?: { type?: string; config?: unknown } | null;
  },
  options?: { allowTemplate?: boolean },
): void {
  if (options?.allowTemplate) return;

  const status = getConversationMessagingWindow(conversation);
  if (status.applies && !status.isOpen) {
    throw new MessagingWindowClosedError(status);
  }
}

export function formatMessagingWindowRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'expirada';
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }
  return `${minutes} min`;
}

export interface WhatsAppSendErrorPayload {
  message: string;
  code?: string | number | null;
  details?: string | null;
  errorSubcode?: string | number | null;
  type?: string | null;
  source?: 'api' | 'webhook';
}

export function parseWhatsAppErrorCodeFromMessage(message?: string | null): number | null {
  if (!message) return null;
  const match = message.match(/\(#(\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractWhatsAppApiError(error: unknown): WhatsAppSendErrorPayload {
  const err = error as {
    message?: string;
    metaSendError?: WhatsAppSendErrorPayload;
    response?: {
      data?: {
        error?: {
          message?: string;
          code?: string | number;
          error_subcode?: string | number;
          type?: string;
          error_data?: { details?: string; messaging_product?: string };
        };
      };
    };
  };

  if (err?.metaSendError) {
    return err.metaSendError;
  }

  const meta = err?.response?.data?.error;
  const message = meta?.message || err?.message || 'Erro ao enviar mensagem pelo WhatsApp';
  const code = meta?.code ?? parseWhatsAppErrorCodeFromMessage(message);

  return {
    message,
    code: code ?? null,
    details: meta?.error_data?.details ?? null,
    errorSubcode: meta?.error_subcode ?? null,
    type: meta?.type ?? null,
    source: 'api',
  };
}

export function extractWhatsAppWebhookStatusError(status: {
  errors?: Array<{
    code?: string | number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
}): WhatsAppSendErrorPayload | null {
  const first = status?.errors?.[0];
  if (!first) return null;

  const message =
    first.message ||
    first.title ||
    (first.code != null ? `(#${first.code}) Falha no envio` : 'Falha no envio pelo WhatsApp');

  return {
    message,
    code: first.code ?? parseWhatsAppErrorCodeFromMessage(message),
    details: first.error_data?.details ?? null,
    errorSubcode: null,
    type: null,
    source: 'webhook',
  };
}
