-- Correção idempotente: garante colunas esperadas pelo schema mesmo se migrações anteriores
-- estiverem marcadas como aplicadas sem o SQL ter efeito (drift / falha parcial).

ALTER TABLE "PipelineTask" ADD COLUMN IF NOT EXISTS "notified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "autoCloseAfterMinutes" INTEGER;
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "autoCloseMessage" TEXT;

ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;

CREATE INDEX IF NOT EXISTS "Bot_sectorId_idx" ON "Bot"("sectorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bot_sectorId_fkey') THEN
    ALTER TABLE "Bot"
      ADD CONSTRAINT "Bot_sectorId_fkey"
      FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "WebhookConfig" ADD COLUMN IF NOT EXISTS "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebhookConfig" ADD COLUMN IF NOT EXISTS "autoCloseAfterMinutes" INTEGER;
ALTER TABLE "WebhookConfig" ADD COLUMN IF NOT EXISTS "autoCloseMessage" TEXT;
