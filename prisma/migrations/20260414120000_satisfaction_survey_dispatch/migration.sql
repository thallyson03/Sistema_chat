-- CreateEnum
CREATE TYPE "SatisfactionSurveyDispatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SatisfactionSurveyDispatch" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "status" "SatisfactionSurveyDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "promptMessageId" TEXT,
    "responseMessageId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SatisfactionSurveyDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SatisfactionSurveyDispatch_conversationId_status_idx" ON "SatisfactionSurveyDispatch"("conversationId", "status");

-- AddForeignKey
ALTER TABLE "SatisfactionSurveyDispatch" ADD CONSTRAINT "SatisfactionSurveyDispatch_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SatisfactionSurveyDispatch" ADD CONSTRAINT "SatisfactionSurveyDispatch_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
