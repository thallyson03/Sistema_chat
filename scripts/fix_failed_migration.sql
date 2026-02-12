-- Script para resolver migration falhada
-- Execute este script no PostgreSQL antes de rodar npx prisma migrate deploy novamente

-- 1. Remover o registro da migration falhada da tabela _prisma_migrations
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260206095313_update_deal_and_add_custom_fields';

-- 2. Verificar se as colunas já existem antes de criar
DO $$
BEGIN
    -- Adicionar coluna name se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Deal' AND column_name = 'name') THEN
        ALTER TABLE "Deal" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Novo Negócio';
    END IF;

    -- Adicionar coluna customFields se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Deal' AND column_name = 'customFields') THEN
        ALTER TABLE "Deal" ADD COLUMN "customFields" JSONB;
    END IF;

    -- Remover colunas antigas se existirem
    ALTER TABLE "Deal" DROP COLUMN IF EXISTS "title";
    ALTER TABLE "Deal" DROP COLUMN IF EXISTS "description";
    ALTER TABLE "Deal" DROP COLUMN IF EXISTS "metadata";
END $$;

-- 3. Criar tabela PipelineCustomField se não existir
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

-- 4. Criar índices se não existirem
CREATE INDEX IF NOT EXISTS "PipelineCustomField_pipelineId_idx" ON "PipelineCustomField"("pipelineId");
CREATE INDEX IF NOT EXISTS "PipelineCustomField_order_idx" ON "PipelineCustomField"("order");

-- 5. Adicionar foreign key se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PipelineCustomField_pipelineId_fkey'
    ) THEN
        ALTER TABLE "PipelineCustomField" 
        ADD CONSTRAINT "PipelineCustomField_pipelineId_fkey" 
        FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Marcar a migration como aplicada (inserir registro na tabela _prisma_migrations)
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid(),
    'fixed_manually',
    NOW(),
    '20260206095313_update_deal_and_add_custom_fields',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT (migration_name) DO NOTHING;



