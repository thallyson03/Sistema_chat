-- Correção idempotente: cria ChannelSector quando a tabela estiver ausente em produção.

CREATE TABLE IF NOT EXISTS "ChannelSector" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "sectorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelSector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelSector_channelId_sectorId_key"
  ON "ChannelSector"("channelId", "sectorId");

CREATE INDEX IF NOT EXISTS "ChannelSector_channelId_idx"
  ON "ChannelSector"("channelId");

CREATE INDEX IF NOT EXISTS "ChannelSector_sectorId_idx"
  ON "ChannelSector"("sectorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChannelSector_channelId_fkey'
  ) THEN
    ALTER TABLE "ChannelSector"
      ADD CONSTRAINT "ChannelSector_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChannelSector_sectorId_fkey'
  ) THEN
    ALTER TABLE "ChannelSector"
      ADD CONSTRAINT "ChannelSector_sectorId_fkey"
      FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
