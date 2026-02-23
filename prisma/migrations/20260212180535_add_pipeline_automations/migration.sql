-- CreateEnum
CREATE TYPE "PipelineAutomationType" AS ENUM ('SALES_BOT', 'CHANGE_STAGE', 'ADD_TASK');

-- CreateTable
CREATE TABLE "PipelineAutomationRule" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" "PipelineAutomationType" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineTask" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineAutomationRule_pipelineId_stageId_idx" ON "PipelineAutomationRule"("pipelineId", "stageId");

-- CreateIndex
CREATE INDEX "PipelineAutomationRule_stageId_active_idx" ON "PipelineAutomationRule"("stageId", "active");

-- CreateIndex
CREATE INDEX "PipelineTask_dealId_idx" ON "PipelineTask"("dealId");

-- CreateIndex
CREATE INDEX "PipelineTask_status_idx" ON "PipelineTask"("status");

-- AddForeignKey
ALTER TABLE "PipelineAutomationRule" ADD CONSTRAINT "PipelineAutomationRule_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineAutomationRule" ADD CONSTRAINT "PipelineAutomationRule_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineTask" ADD CONSTRAINT "PipelineTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
