import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWhatsAppOfficialChannel() {
  try {
    console.log('🔍 Verificando canais WhatsApp Official no banco de dados...\n');

    // Buscar todos os canais WhatsApp
    const whatsappChannels = await prisma.channel.findMany({
      where: {
        type: 'WHATSAPP',
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        config: true,
        evolutionInstanceId: true,
        evolutionApiKey: true,
        createdAt: true,
      },
    });

    console.log(`📊 Total de canais WhatsApp encontrados: ${whatsappChannels.length}\n`);

    if (whatsappChannels.length === 0) {
      console.log('❌ Nenhum canal WhatsApp encontrado no banco de dados.');
      return;
    }

    // Verificar quais são Official
    const officialChannels = whatsappChannels.filter((channel) => {
      const config = channel.config as any;
      return config?.provider === 'whatsapp_official';
    });

    console.log('📋 Canais encontrados:\n');
    whatsappChannels.forEach((channel, index) => {
      const config = channel.config as any;
      const isOfficial = config?.provider === 'whatsapp_official';
      
      console.log(`${index + 1}. ${channel.name}`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Tipo: ${channel.type}`);
      console.log(`   Status: ${channel.status}`);
      console.log(`   Provider: ${config?.provider || 'evolution'}`);
      console.log(`   É Official: ${isOfficial ? '✅ SIM' : '❌ NÃO'}`);
      if (isOfficial) {
        console.log(`   Phone Number ID: ${config?.phoneNumberId || 'N/A'}`);
        console.log(`   Business Account ID: ${config?.businessAccountId || 'N/A'}`);
      } else {
        console.log(`   Evolution Instance ID: ${channel.evolutionInstanceId || 'N/A'}`);
        console.log(`   Evolution API Key: ${channel.evolutionApiKey ? '✅ Configurado' : '❌ Não configurado'}`);
      }
      console.log(`   Criado em: ${channel.createdAt}`);
      console.log('');
    });

    if (officialChannels.length > 0) {
      console.log(`\n✅ ${officialChannels.length} canal(is) WhatsApp Official encontrado(s):`);
      officialChannels.forEach((channel) => {
        console.log(`   - ${channel.name} (ID: ${channel.id})`);
      });
    } else {
      console.log('\n❌ Nenhum canal WhatsApp Official encontrado.');
      console.log('💡 Para criar um canal Official, use a interface em http://localhost:3000/channels');
      console.log('   ou execute o script: node scripts/createWhatsAppOfficialChannel.js');
    }
  } catch (error: any) {
    console.error('❌ Erro ao verificar canais:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkWhatsAppOfficialChannel();

