-- Índices de performance para listagens e distribuição de conversas.
-- Mantém idempotência para ambientes já parcialmente migrados.

CREATE INDEX IF NOT EXISTS "Conversation_status_assignedToId_lastMessageAt_idx"
  ON "Conversation"("status", "assignedToId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "Conversation_channelId_status_lastMessageAt_idx"
  ON "Conversation"("channelId", "status", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "Conversation_sectorId_status_lastMessageAt_idx"
  ON "Conversation"("sectorId", "status", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
