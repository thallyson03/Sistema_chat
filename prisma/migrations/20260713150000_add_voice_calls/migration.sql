-- AlterEnum ChannelType (PostgreSQL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ChannelType' AND e.enumlabel = 'VOICE'
  ) THEN
    ALTER TYPE "ChannelType" ADD VALUE 'VOICE';
  END IF;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VoiceCallDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoiceCallStatus" AS ENUM ('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'BUSY', 'FAILED', 'NO_ANSWER', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VoiceCall" (
    "id" TEXT NOT NULL,
    "providerCallId" TEXT,
    "channelId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "dealId" TEXT,
    "userId" TEXT,
    "direction" "VoiceCallDirection" NOT NULL,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'QUEUED',
    "fromE164" TEXT,
    "toE164" TEXT,
    "durationSeconds" INTEGER,
    "recordingUrl" TEXT,
    "recordingSid" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceCall_providerCallId_key" ON "VoiceCall"("providerCallId");
CREATE INDEX IF NOT EXISTS "VoiceCall_channelId_idx" ON "VoiceCall"("channelId");
CREATE INDEX IF NOT EXISTS "VoiceCall_contactId_idx" ON "VoiceCall"("contactId");
CREATE INDEX IF NOT EXISTS "VoiceCall_conversationId_idx" ON "VoiceCall"("conversationId");
CREATE INDEX IF NOT EXISTS "VoiceCall_dealId_idx" ON "VoiceCall"("dealId");
CREATE INDEX IF NOT EXISTS "VoiceCall_userId_idx" ON "VoiceCall"("userId");
CREATE INDEX IF NOT EXISTS "VoiceCall_status_idx" ON "VoiceCall"("status");
CREATE INDEX IF NOT EXISTS "VoiceCall_startedAt_idx" ON "VoiceCall"("startedAt");

DO $$ BEGIN
  ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
