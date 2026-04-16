-- Integração: mapeamento de setor local -> setor remoto (CEAPDesk)
ALTER TABLE "Sector"
ADD COLUMN IF NOT EXISTS "ticketSystemSectorId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Sector_ticketSystemSectorId_key"
ON "Sector" ("ticketSystemSectorId");
