-- Integração: usuário local ↔ sistema externo de tickets
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ticketSystemUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ticketSystemSyncedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ticketSystemSyncError" TEXT;
