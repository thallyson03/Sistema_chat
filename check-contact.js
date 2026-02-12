const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findContact() {
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
      console.log(`Telefone (phone): ${contact.phone || 'Não informado'}`);
      console.log(`Channel Identifier: ${contact.channelIdentifier}`);
      console.log(`Canal: ${contact.channel.name} (${contact.channel.type})`);
      console.log(`Email: ${contact.email || 'Não informado'}`);
      console.log(`Foto de perfil: ${contact.profilePicture ? 'Sim' : 'Não'}`);
      console.log(`Criado em: ${contact.createdAt}`);
      console.log(`Atualizado em: ${contact.updatedAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro ao buscar contato:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findContact();



