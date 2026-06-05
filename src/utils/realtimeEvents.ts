import { phase1Flags } from '../config/phase1Flags';

type ConversationDelta = {
  conversationId: string;
  channelId?: string | null;
  messageId?: string | null;
};

export function emitConversationDelta(io: any, event: 'new_message' | 'conversation_updated', delta: ConversationDelta): void {
  if (!io || !delta?.conversationId) return;

  const payload = {
    conversationId: delta.conversationId,
    channelId: delta.channelId || undefined,
    messageId: delta.messageId || undefined,
  };

  io.to(`conversation_${delta.conversationId}`).emit(event, payload);
  if (delta.channelId) {
    io.to(`channel_${delta.channelId}`).emit(event, payload);
  }

  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit(event, payload);
  }
}

export function emitMessageStatus(
  io: any,
  data: {
    conversationId: string;
    messageId: string;
    status: string;
    sendError?: Record<string, unknown>;
  },
): void {
  if (!io || !data?.conversationId || !data?.messageId) return;

  io.to(`conversation_${data.conversationId}`).emit('message_status', data);
  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit('message_status', data);
  }
}

export function emitMessageContentUpdate(
  io: any,
  data: { conversationId: string; messageId: string; content: string },
): void {
  if (!io || !data?.conversationId || !data?.messageId) return;

  io.to(`conversation_${data.conversationId}`).emit('message_updated', data);
  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit('message_updated', data);
  }
}

export function emitContactPresence(
  io: any,
  data: {
    conversationId: string;
    channelId: string;
    state: 'composing' | 'recording' | 'available' | 'unavailable' | 'paused' | null;
    contactPhone?: string;
  },
): void {
  if (!io || !data?.conversationId) return;

  io.to(`conversation_${data.conversationId}`).emit('contact_presence', data);
  if (data.channelId) {
    io.to(`channel_${data.channelId}`).emit('contact_presence', data);
  }
  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit('contact_presence', data);
  }
}

export function emitQrcodeUpdate(
  io: any,
  data: { channelId: string; qrcode: string | null },
): void {
  if (!io || !data?.channelId) return;

  io.to(`channel_${data.channelId}`).emit('qrcode_update', data);
  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit('qrcode_update', data);
  }
}

export function emitChannelStatusUpdate(
  io: any,
  data: { channelId: string; status: string },
): void {
  if (!io || !data?.channelId) return;

  io.to(`channel_${data.channelId}`).emit('channel_status_update', data);
  // Status de canal (QR/conexão) sempre em broadcast — crítico para fechar o modal.
  io.emit('channel_status_update', data);
}

