-- Colunas do schema.prisma que não tinham migração correspondente

ALTER TABLE "PipelineTask" ADD COLUMN "notified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Bot" ADD COLUMN "sectorId" TEXT;

CREATE INDEX "Bot_sectorId_idx" ON "Bot"("sectorId");

ALTER TABLE "Bot" ADD CONSTRAINT "Bot_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebhookConfig" ADD COLUMN "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebhookConfig" ADD COLUMN "autoCloseAfterMinutes" INTEGER;
ALTER TABLE "WebhookConfig" ADD COLUMN "autoCloseMessage" TEXT;
