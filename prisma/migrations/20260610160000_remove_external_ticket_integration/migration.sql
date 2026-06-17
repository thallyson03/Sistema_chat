-- Remove integração com sistema externo de tickets (CEAPDesk)

DROP INDEX IF EXISTS "Sector_ticketSystemSectorId_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "ticketSystemUserId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "ticketSystemSyncedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "ticketSystemSyncError";

ALTER TABLE "Sector" DROP COLUMN IF EXISTS "ticketSystemSectorId";
