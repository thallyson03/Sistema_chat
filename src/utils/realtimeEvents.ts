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

export function emitMessageStatus(io: any, data: { conversationId: string; messageId: string; status: string }): void {
  if (!io || !data?.conversationId || !data?.messageId) return;

  io.to(`conversation_${data.conversationId}`).emit('message_status', data);
  if (!phase1Flags.realtimeScopedEventsEnabled) {
    io.emit('message_status', data);
  }
}

