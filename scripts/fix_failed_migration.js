// Script Node.js para resolver migration falhada
// Execute: node scripts/fix_failed_migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMigration() {
  try {
    console.log('🔧 Iniciando correção da migration falhada...');

    // 1. Verificar se a tabela Deal tem as colunas necessárias
    console.log('📋 Verificando estrutura da tabela Deal...');
    
    // Verificar se name existe
    const nameExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Deal' AND column_name = 'name'
    `;
    
    if (nameExists.length === 0) {
      console.log('➕ Adicionando coluna name...');
      // Primeiro adicionar como nullable, depois atualizar valores e tornar NOT NULL
      await prisma.$executeRaw`ALTER TABLE "Deal" ADD COLUMN "name" TEXT`;
      // Atualizar valores existentes
      await prisma.$executeRaw`UPDATE "Deal" SET "name" = 'Novo Negócio' WHERE "name" IS NULL`;
      // Tornar NOT NULL
      await prisma.$executeRaw`ALTER TABLE "Deal" ALTER COLUMN "name" SET NOT NULL`;
      await prisma.$executeRaw`ALTER TABLE "Deal" ALTER COLUMN "name" SET DEFAULT 'Novo Negócio'`;
      console.log('✅ Coluna name criada com sucesso');
    } else {
      console.log('✅ Coluna name já existe');
    }

    // Verificar se customFields existe
    const customFieldsExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Deal' AND column_name = 'customFields'
    `;
    
    if (customFieldsExists.length === 0) {
      console.log('➕ Adicionando coluna customFields...');
      await prisma.$executeRaw`ALTER TABLE "Deal" ADD COLUMN "customFields" JSONB`;
    } else {
      console.log('✅ Coluna customFields já existe');
    }

    // Remover colunas antigas
    console.log('🗑️ Removendo colunas antigas...');
    await prisma.$executeRaw`ALTER TABLE "Deal" DROP COLUMN IF EXISTS "title"`;
    await prisma.$executeRaw`ALTER TABLE "Deal" DROP COLUMN IF EXISTS "description"`;
    await prisma.$executeRaw`ALTER TABLE "Deal" DROP COLUMN IF EXISTS "metadata"`;

    // 2. Criar tabela PipelineCustomField se não existir
    console.log('📋 Verificando tabela PipelineCustomField...');
    const tableExists = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'PipelineCustomField'
    `;

    if (tableExists.length === 0) {
      console.log('➕ Criando tabela PipelineCustomField...');
      await prisma.$executeRaw`
        CREATE TABLE "PipelineCustomField" (
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
        )
      `;

      // Criar índices
      await prisma.$executeRaw`
        CREATE INDEX "PipelineCustomField_pipelineId_idx" ON "PipelineCustomField"("pipelineId")
      `;
      await prisma.$executeRaw`
        CREATE INDEX "PipelineCustomField_order_idx" ON "PipelineCustomField"("order")
      `;

      // Adicionar foreign key
      await prisma.$executeRaw`
        ALTER TABLE "PipelineCustomField" 
        ADD CONSTRAINT "PipelineCustomField_pipelineId_fkey" 
        FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `;
    } else {
      console.log('✅ Tabela PipelineCustomField já existe');
    }

    // 3. Remover registro da migration falhada
    console.log('🗑️ Removendo registro da migration falhada...');
    await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '20260206095313_update_deal_and_add_custom_fields'
    `;

    // 4. Marcar migration como aplicada
    console.log('✅ Marcando migration como aplicada...');
    await prisma.$executeRaw`
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
      ON CONFLICT (migration_name) DO NOTHING
    `;

    console.log('✅ Migration corrigida com sucesso!');
    console.log('📝 Agora você pode executar: npx prisma migrate deploy');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration();

