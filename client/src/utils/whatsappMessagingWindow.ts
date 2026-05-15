export const META_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MessagingWindowStatus {
  applies: boolean;
  isOpen: boolean;
  expiresAt: string | null;
  remainingMs: number;
  lastCustomerMessageAt: string | null;
}

export function isWhatsAppOfficialChannel(
  channel?: { type?: string; config?: { provider?: string; phoneNumberId?: string; token?: string } } | null,
): boolean {
  if (!channel || channel.type !== 'WHATSAPP') return false;
  const config = channel.config || {};
  return (
    config.provider === 'whatsapp_official' &&
    !!config.phoneNumberId &&
    !!config.token
  );
}

export function getMessagingWindowStatus(
  lastCustomerMessageAt: string | null | undefined,
  applies: boolean,
  nowMs: number = Date.now(),
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

  const lastIso = lastCustomerMessageAt || null;
  if (!lastIso) {
    return {
      applies: true,
      isOpen: false,
      expiresAt: null,
      remainingMs: 0,
      lastCustomerMessageAt: null,
    };
  }

  const lastAt = new Date(lastIso);
  if (Number.isNaN(lastAt.getTime())) {
    return {
      applies: true,
      isOpen: false,
      expiresAt: null,
      remainingMs: 0,
      lastCustomerMessageAt: null,
    };
  }

  const expiresAtMs = lastAt.getTime() + META_MESSAGING_WINDOW_MS;
  const remainingMs = Math.max(0, expiresAtMs - nowMs);

  return {
    applies: true,
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingMs,
    lastCustomerMessageAt: lastIso,
  };
}

export function resolveConversationMessagingWindow(
  conversation: {
    lastCustomerMessageAt?: string | null;
    messagingWindow?: MessagingWindowStatus;
    channel?: { type?: string; config?: { provider?: string; phoneNumberId?: string; token?: string } };
  },
  nowMs: number = Date.now(),
): MessagingWindowStatus {
  const applies =
    conversation.messagingWindow?.applies ??
    isWhatsAppOfficialChannel(conversation.channel);
  const lastAt =
    conversation.messagingWindow?.lastCustomerMessageAt ??
    conversation.lastCustomerMessageAt ??
    null;
  return getMessagingWindowStatus(lastAt, applies, nowMs);
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

export function getSendBlockedReason(
  messagingWindow: MessagingWindowStatus,
  hasPendingTemplate: boolean,
): string | null {
  if (!messagingWindow.applies || messagingWindow.isOpen || hasPendingTemplate) {
    return null;
  }
  if (!messagingWindow.lastCustomerMessageAt) {
    return 'O cliente ainda não enviou mensagem nesta conversa. Use um template aprovado para iniciar o contato.';
  }
  return 'A janela de 24 horas expirou. Use um template aprovado (respostas rápidas) para retomar o contato.';
}
