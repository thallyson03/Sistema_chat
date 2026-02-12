-- AlterTable: Atualizar Deal para usar name ao invés de title e adicionar customFields
ALTER TABLE "Deal" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Deal" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Deal" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Novo Negócio';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "customFields" JSONB;

-- Criar tabela PipelineCustomField
CREATE TABLE IF NOT EXISTS "PipelineCustomField" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineCustomField_pkey" PRIMARY KEY ("id")
);

-- Criar índices
CREATE INDEX IF NOT EXISTS "PipelineCustomField_pipelineId_idx" ON "PipelineCustomField"("pipelineId");
CREATE INDEX IF NOT EXISTS "PipelineCustomField_order_idx" ON "PipelineCustomField"("order");

-- Adicionar foreign key
ALTER TABLE "PipelineCustomField" ADD CONSTRAINT "PipelineCustomField_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Atualização de dados não é necessária aqui porque a coluna title já foi removida
