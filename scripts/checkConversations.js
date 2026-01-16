const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkConversations() {
  try {
    console.log('🔍 Verificando conversas no banco de dados...\n');

    // Contar conversas
    const totalConversations = await prisma.conversation.count();
    console.log(`📊 Total de conversas: ${totalConversations}`);

    // Listar conversas
    const conversations = await prisma.conversation.findMany({
      take: 10,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    console.log(`\n📋 Primeiras ${conversations.length} conversas:\n`);

    conversations.forEach((conv, idx) => {
      console.log(`${idx + 1}. ID: ${conv.id}`);
      console.log(`   Canal: ${conv.channel.name} (${conv.channel.status})`);
      console.log(`   Contato: ${conv.contact.name} (${conv.contact.phone})`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Não lidas: ${conv.unreadCount}`);
      console.log(`   Última mensagem: ${conv.lastMessageAt || 'N/A'}`);
      console.log(`   Mensagens: ${conv.messages.length > 0 ? conv.messages[0].content.substring(0, 50) : 'Nenhuma'}`);
      console.log('');
    });

    // Verificar mensagens
    const totalMessages = await prisma.message.count();
    console.log(`📨 Total de mensagens: ${totalMessages}`);

    // Verificar contatos
    const totalContacts = await prisma.contact.count();
    console.log(`👤 Total de contatos: ${totalContacts}`);

    // Verificar canais
    const channels = await prisma.channel.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        evolutionInstanceId: true,
      },
    });
    console.log(`\n📡 Canais (${channels.length}):`);
    channels.forEach((ch) => {
      console.log(`   - ${ch.name} (${ch.type}, ${ch.status}) - Instance: ${ch.evolutionInstanceId || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConversations();


