-- Adiciona configuração de encerramento automático por inatividade ao Bot

ALTER TABLE "Bot"
ADD COLUMN "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Bot"
ADD COLUMN "autoCloseAfterMinutes" INTEGER;

ALTER TABLE "Bot"
ADD COLUMN "autoCloseMessage" TEXT;

