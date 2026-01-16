const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChannels() {
  try {
    console.log('🔍 Verificando canais no banco de dados...\n');
    
    const channels = await prisma.channel.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Total de canais encontrados: ${channels.length}\n`);

    if (channels.length === 0) {
      console.log('⚠️ Nenhum canal encontrado no banco de dados.');
      return;
    }

    channels.forEach((channel, index) => {
      console.log(`\n${index + 1}. Canal:`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Nome: "${channel.name}"`);
      console.log(`   Tipo: ${channel.type}`);
      console.log(`   Status: ${channel.status}`);
      console.log(`   Instance ID: ${channel.evolutionInstanceId || 'N/A'}`);
      console.log(`   Criado em: ${channel.createdAt}`);
      console.log(`   Atualizado em: ${channel.updatedAt}`);
    });

    // Verificar especificamente o canal "Principal"
    const principalChannel = channels.find(c => c.name === 'Principal' || c.name.includes('Principal'));
    if (principalChannel) {
      console.log('\n✅ Canal "Principal" encontrado!');
      console.log(JSON.stringify(principalChannel, null, 2));
    } else {
      console.log('\n❌ Canal "Principal" NÃO encontrado.');
      console.log('Canais disponíveis:');
      channels.forEach(c => console.log(`  - "${c.name}"`));
    }

  } catch (error) {
    console.error('❌ Erro ao verificar canais:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChannels();


