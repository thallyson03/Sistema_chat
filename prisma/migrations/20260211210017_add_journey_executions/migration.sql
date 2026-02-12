-- CreateTable
CREATE TABLE "JourneyExecution" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentNodeId" TEXT,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "JourneyExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyExecution_journeyId_idx" ON "JourneyExecution"("journeyId");

-- CreateIndex
CREATE INDEX "JourneyExecution_contactId_idx" ON "JourneyExecution"("contactId");

-- CreateIndex
CREATE INDEX "JourneyExecution_status_idx" ON "JourneyExecution"("status");

-- CreateIndex
CREATE INDEX "JourneyExecution_startedAt_idx" ON "JourneyExecution"("startedAt");

-- AddForeignKey
ALTER TABLE "JourneyExecution" ADD CONSTRAINT "JourneyExecution_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyExecution" ADD CONSTRAINT "JourneyExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
