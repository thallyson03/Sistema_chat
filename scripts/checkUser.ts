import prisma from '../src/config/database';

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'admin@sistema.com' },
    });

    if (user) {
      console.log('Usuário encontrado:');
      console.log(JSON.stringify(user, null, 2));
      console.log(`\nRole: ${user.role}`);
      console.log(`IsActive: ${user.isActive}`);
    } else {
      console.log('Usuário não encontrado!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Erro:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUser();





