-- Histórico de notas de encerramento de tickets

CREATE TABLE IF NOT EXISTS "TicketClosureNote" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketClosureNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketClosureNote_ticketId_createdAt_idx"
  ON "TicketClosureNote"("ticketId", "createdAt");

ALTER TABLE "TicketClosureNote"
  DROP CONSTRAINT IF EXISTS "TicketClosureNote_ticketId_fkey";
ALTER TABLE "TicketClosureNote"
  ADD CONSTRAINT "TicketClosureNote_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketClosureNote"
  DROP CONSTRAINT IF EXISTS "TicketClosureNote_userId_fkey";
ALTER TABLE "TicketClosureNote"
  ADD CONSTRAINT "TicketClosureNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
