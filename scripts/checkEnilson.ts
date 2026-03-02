import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findEnilson() {
  try {
    console.log('🔍 Buscando contato "Enilson"...\n');
    
    const contacts = await prisma.contact.findMany({
      where: {
        name: {
          contains: 'Enilson',
          mode: 'insensitive',
        },
      },
      include: {
        channel: {
          select: {
            name: true,
            type: true,
          },
        },
        conversations: {
          take: 1,
          orderBy: {
            lastMessageAt: 'desc',
          },
          select: {
            id: true,
            status: true,
            lastMessageAt: true,
          },
        },
      },
    });

    if (contacts.length === 0) {
      console.log('❌ Nenhum contato encontrado com o nome "Enilson"');
      return;
    }

    console.log(`✅ Encontrados ${contacts.length} contato(s):\n`);

    contacts.forEach((contact, index) => {
      console.log(`--- Contato ${index + 1} ---`);
      console.log(`ID: ${contact.id}`);
      console.log(`Nome: ${contact.name}`);
      console.log(`📱 Telefone (phone): ${contact.phone || '❌ Não informado'}`);
      console.log(`🔑 Channel Identifier: ${contact.channelIdentifier}`);
      console.log(`📞 Canal: ${contact.channel.name} (${contact.channel.type})`);
      console.log(`📧 Email: ${contact.email || 'Não informado'}`);
      console.log(`🖼️ Foto de perfil: ${contact.profilePicture ? '✅ Sim' : '❌ Não'}`);
      console.log(`💬 Conversas: ${contact.conversations.length}`);
      if (contact.conversations.length > 0) {
        console.log(`   Última conversa: ${contact.conversations[0].id} (${contact.conversations[0].status})`);
        console.log(`   Última mensagem: ${contact.conversations[0].lastMessageAt || 'N/A'}`);
      }
      console.log(`📅 Criado em: ${contact.createdAt}`);
      console.log(`🔄 Atualizado em: ${contact.updatedAt}`);
      console.log('');
    });

    // Verificar se o channelIdentifier é um LID
    contacts.forEach((contact) => {
      if (contact.channelIdentifier.includes('@lid')) {
        console.log(`⚠️ ATENÇÃO: O contato "${contact.name}" tem um LID como identificador: ${contact.channelIdentifier}`);
        console.log(`   Isso significa que o número real do telefone não foi capturado ainda.`);
        console.log(`   O número será atualizado automaticamente quando uma nova mensagem chegar com número real.`);
        console.log('');
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar contato:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findEnilson();





