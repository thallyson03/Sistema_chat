// Script para verificar estrutura da tabela Deal
// Execute: node scripts/check_deal_table.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDealTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela Deal...\n');

    // Verificar todas as colunas da tabela Deal
    const columns = await prisma.$queryRaw`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'Deal'
      ORDER BY ordinal_position
    `;

    console.log('📋 Colunas encontradas na tabela Deal:');
    console.table(columns);

    // Verificar se name existe
    const nameExists = columns.some(col => col.column_name === 'name');
    const titleExists = columns.some(col => col.column_name === 'title');
    const customFieldsExists = columns.some(col => col.column_name === 'customFields');

    console.log('\n📊 Status das colunas:');
    console.log(`  - name: ${nameExists ? '✅ Existe' : '❌ Não existe'}`);
    console.log(`  - title: ${titleExists ? '⚠️ Existe (deve ser removida)' : '✅ Não existe'}`);
    console.log(`  - customFields: ${customFieldsExists ? '✅ Existe' : '❌ Não existe'}`);

    // Verificar se há registros
    const count = await prisma.deal.count();
    console.log(`\n📊 Total de deals: ${count}`);

    if (count > 0 && !nameExists) {
      console.log('\n⚠️ ATENÇÃO: Existem deals no banco mas a coluna name não existe!');
      console.log('   Execute: node scripts/fix_failed_migration.js');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDealTable();



