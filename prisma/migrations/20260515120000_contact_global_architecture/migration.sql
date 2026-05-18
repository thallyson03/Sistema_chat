-- Fase estrutural: ContactChannelIdentity + channelSnapshot (dados legados migrados via scripts/migrateContactArchitecture.ts)

CREATE TABLE IF NOT EXISTS "ContactChannelIdentity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactChannelIdentity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "channelSnapshot" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "ContactChannelIdentity_channelId_externalId_key"
ON "ContactChannelIdentity"("channelId", "externalId");

CREATE INDEX IF NOT EXISTS "ContactChannelIdentity_contactId_idx" ON "ContactChannelIdentity"("contactId");

ALTER TABLE "ContactChannelIdentity" DROP CONSTRAINT IF EXISTS "ContactChannelIdentity_contactId_fkey";
ALTER TABLE "ContactChannelIdentity" ADD CONSTRAINT "ContactChannelIdentity_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactChannelIdentity" DROP CONSTRAINT IF EXISTS "ContactChannelIdentity_channelId_fkey";
ALTER TABLE "ContactChannelIdentity" ADD CONSTRAINT "ContactChannelIdentity_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_one_active_per_contact_channel"
ON "Conversation" ("contactId", "channelId")
WHERE "status" IN ('OPEN', 'WAITING') AND "channelId" IS NOT NULL;
