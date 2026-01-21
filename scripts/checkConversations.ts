import prisma from '../src/config/database';

async function checkConversations() {
  try {
    console.log('🔍 Verificando conversas no banco de dados...\n');

    // Contar total de conversas
    const total = await prisma.conversation.count();
    console.log(`📊 Total de conversas: ${total}`);

    if (total === 0) {
      console.log('⚠️ Nenhuma conversa encontrada no banco de dados.');
      return;
    }

    // Listar algumas conversas
    const conversations = await prisma.conversation.findMany({
      take: 10,
      include: {
        contact: {
          select: {
            name: true,
            phone: true,
          },
        },
        channel: {
          select: {
            name: true,
            type: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    console.log('\n📋 Últimas conversas:');
    conversations.forEach((conv, index) => {
      console.log(`\n${index + 1}. ${conv.contact.name} (${conv.contact.phone || 'Sem telefone'})`);
      console.log(`   Canal: ${conv.channel.name} (${conv.channel.type})`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Última mensagem: ${conv.messages[0]?.content || 'Nenhuma'} (${conv.lastMessageAt || 'Nunca'})`);
      console.log(`   Criada em: ${conv.createdAt}`);
    });

    // Verificar se há conversas sem lastMessageAt
    const withoutLastMessage = await prisma.conversation.count({
      where: {
        lastMessageAt: null,
      },
    });

    if (withoutLastMessage > 0) {
      console.log(`\n⚠️ ${withoutLastMessage} conversas sem lastMessageAt`);
    }

    // Verificar se há conversas sem mensagens
    const conversationsWithMessages = await prisma.conversation.findMany({
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const withoutMessages = conversationsWithMessages.filter((c) => c._count.messages === 0).length;
    if (withoutMessages > 0) {
      console.log(`\n⚠️ ${withoutMessages} conversas sem mensagens`);
    }

    console.log('\n✅ Verificação concluída!');
  } catch (error: any) {
    console.error('❌ Erro ao verificar conversas:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConversations();

