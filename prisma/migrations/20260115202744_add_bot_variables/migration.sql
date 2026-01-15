-- CreateTable
CREATE TABLE "BotVariable" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultValue" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotVariable_botId_idx" ON "BotVariable"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotVariable_botId_name_key" ON "BotVariable"("botId", "name");

-- AddForeignKey
ALTER TABLE "BotVariable" ADD CONSTRAINT "BotVariable_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
