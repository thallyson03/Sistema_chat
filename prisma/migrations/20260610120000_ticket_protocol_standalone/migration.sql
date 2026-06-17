-- Protocolo de 4 dígitos e tickets avulsos (sem conversa/contato obrigatório)

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "protocol" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "requesterName" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "requesterPhone" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "requesterEmail" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;

-- Backfill protocolo sequencial para tickets existentes
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM "Ticket"
  WHERE "protocol" IS NULL
)
UPDATE "Ticket" t
SET "protocol" = LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE t.id = n.id;

UPDATE "Ticket"
SET "protocol" = LPAD((FLOOR(random() * 10000))::text, 4, '0')
WHERE "protocol" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "protocol" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_protocol_key" ON "Ticket"("protocol");

ALTER TABLE "Ticket" ALTER COLUMN "conversationId" DROP NOT NULL;

ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_conversationId_fkey";
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_contactId_fkey";
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_sectorId_fkey";
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_sectorId_fkey"
  FOREIGN KEY ("sectorId") REFERENCES "Sector"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Ticket_sectorId_idx" ON "Ticket"("sectorId");
CREATE INDEX IF NOT EXISTS "Ticket_requesterPhone_idx" ON "Ticket"("requesterPhone");
