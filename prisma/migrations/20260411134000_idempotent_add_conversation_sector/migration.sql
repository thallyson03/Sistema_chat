-- Correção idempotente: garante Conversation.sectorId no banco de produção.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;

CREATE INDEX IF NOT EXISTS "Conversation_sectorId_idx" ON "Conversation"("sectorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_sectorId_fkey') THEN
    ALTER TABLE "Conversation"
      ADD CONSTRAINT "Conversation_sectorId_fkey"
      FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
