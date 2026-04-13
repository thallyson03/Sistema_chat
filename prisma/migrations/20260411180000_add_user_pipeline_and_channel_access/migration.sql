-- Tabelas de permissão User <-> Pipeline e User <-> Channel.
-- Estavam no schema Prisma sem migração correspondente; bancos antigos falhavam em listUsers/createUser.
-- Idempotente: seguro se rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS "UserPipelineAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPipelineAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPipelineAccess_userId_pipelineId_key" ON "UserPipelineAccess"("userId", "pipelineId");
CREATE INDEX IF NOT EXISTS "UserPipelineAccess_pipelineId_idx" ON "UserPipelineAccess"("pipelineId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserPipelineAccess_userId_fkey') THEN
    ALTER TABLE "UserPipelineAccess" ADD CONSTRAINT "UserPipelineAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserPipelineAccess_pipelineId_fkey') THEN
    ALTER TABLE "UserPipelineAccess" ADD CONSTRAINT "UserPipelineAccess_pipelineId_fkey"
      FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserChannelAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserChannelAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserChannelAccess_userId_channelId_key" ON "UserChannelAccess"("userId", "channelId");
CREATE INDEX IF NOT EXISTS "UserChannelAccess_channelId_idx" ON "UserChannelAccess"("channelId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserChannelAccess_userId_fkey') THEN
    ALTER TABLE "UserChannelAccess" ADD CONSTRAINT "UserChannelAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserChannelAccess_channelId_fkey') THEN
    ALTER TABLE "UserChannelAccess" ADD CONSTRAINT "UserChannelAccess_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
