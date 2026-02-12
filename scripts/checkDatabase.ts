import prisma from '../src/config/database';

async function checkDatabase() {
  try {
    console.log('🔍 Verificando estado do banco de dados...\n');

    // Contar registros em cada tabela principal
    const counts = {
      users: await prisma.user.count(),
      channels: await prisma.channel.count(),
      contacts: await prisma.contact.count(),
      conversations: await prisma.conversation.count(),
      messages: await prisma.message.count(),
      pipelines: await prisma.pipeline.count(),
      deals: await prisma.deal.count(),
      campaigns: await prisma.campaign.count(),
    };

    console.log('📊 Contagem de registros:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👥 Usuários:           ${counts.users}`);
    console.log(`📡 Canais:             ${counts.channels}`);
    console.log(`📇 Contatos:           ${counts.contacts}`);
    console.log(`💬 Conversas:          ${counts.conversations}`);
    console.log(`📨 Mensagens:         ${counts.messages}`);
    console.log(`📈 Pipelines:          ${counts.pipelines}`);
    console.log(`💼 Deals:              ${counts.deals}`);
    console.log(`📢 Campanhas:          ${counts.campaigns}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verificar alguns registros específicos
    if (counts.users > 0) {
      const users = await prisma.user.findMany({ take: 5 });
      console.log('👤 Primeiros usuários:');
      users.forEach((u) => {
        console.log(`   - ${u.name} (${u.email}) - ${u.role}`);
      });
      console.log('');
    }

    if (counts.channels > 0) {
      const channels = await prisma.channel.findMany({ take: 10 });
      console.log('📡 Canais:');
      channels.forEach((c) => {
        console.log(`   - ${c.name} (${c.type}) - ${c.status}`);
        console.log(`     ID: ${c.id}`);
        console.log(`     evolutionInstanceId: ${c.evolutionInstanceId || 'NÃO CONFIGURADO'}`);
        console.log(`     evolutionApiKey: ${c.evolutionApiKey ? '✅ Configurado' : '❌ Não configurado'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ NENHUM CANAL ENCONTRADO NO BANCO DE DADOS!');
      console.log('   Isso explica por que as mensagens não estão sendo processadas.');
      console.log('   Você precisa criar pelo menos um canal no sistema.\n');
    }

    if (counts.contacts > 0) {
      const contacts = await prisma.contact.findMany({ take: 10, include: { channel: { select: { name: true } } } });
      console.log('📇 Primeiros contatos:');
      contacts.forEach((c) => {
        console.log(`   - ${c.name} (${c.phone || 'sem telefone'})`);
        console.log(`     Canal: ${c.channel?.name || 'N/A'}`);
        console.log(`     channelIdentifier: ${c.channelIdentifier}`);
        console.log('');
      });
    } else {
      console.log('ℹ️ Nenhum contato encontrado (normal se ainda não recebeu mensagens)\n');
    }

    if (counts.conversations > 0) {
      const conversations = await prisma.conversation.findMany({ 
        take: 5, 
        include: { 
          contact: { select: { name: true, phone: true } },
          channel: { select: { name: true } }
        } 
      });
      console.log('💬 Primeiras conversas:');
      conversations.forEach((conv) => {
        console.log(`   - ${conv.contact.name} (${conv.contact.phone || 'N/A'})`);
        console.log(`     Canal: ${conv.channel?.name || 'N/A'}`);
        console.log(`     Status: ${conv.status}`);
        console.log(`     Mensagens não lidas: ${conv.unreadCount}`);
        console.log('');
      });
    } else {
      console.log('ℹ️ Nenhuma conversa encontrada (normal se ainda não recebeu mensagens)\n');
    }

    // Verificar se a tabela Campaign tem os novos campos
    try {
      const testCampaign = await prisma.campaign.findFirst();
      if (testCampaign) {
        console.log('✅ Tabela Campaign existe e tem dados');
        console.log(`   - startedAt: ${testCampaign.startedAt ? '✅ Campo existe' : '⚠️ Campo NULL'}`);
        console.log(`   - completedAt: ${testCampaign.completedAt ? '✅ Campo existe' : '⚠️ Campo NULL'}`);
      } else {
        console.log('ℹ️ Tabela Campaign existe mas está vazia (normal se não criou campanhas ainda)');
      }
    } catch (error: any) {
      console.log('❌ Erro ao verificar tabela Campaign:', error.message);
      console.log('   Isso pode indicar que a migration não foi aplicada ainda.');
    }

    console.log('\n✅ Verificação concluída!');
  } catch (error: any) {
    console.error('❌ Erro ao verificar banco de dados:', error.message);
    console.error('\nPossíveis causas:');
    console.error('1. Banco de dados não está rodando');
    console.error('2. DATABASE_URL incorreto no .env');
    console.error('3. Migration não foi aplicada');
    console.error('\nSoluções:');
    console.error('- Verifique se o PostgreSQL está rodando');
    console.error('- Verifique o arquivo .env');
    console.error('- Execute: npx prisma migrate deploy');
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

