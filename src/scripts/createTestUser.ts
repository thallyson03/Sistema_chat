import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { validatePassword } from '../utils/passwordPolicy';

async function createTestUser() {
  if (process.env.NODE_ENV === 'production') {
    console.error('createTestUser não pode ser executado em produção.');
    process.exit(1);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.CREATE_USER_ADMIN_PASSWORD;
  const testPassword = process.env.SEED_TEST_PASSWORD || process.env.CREATE_USER_TEST_PASSWORD;

  if (!adminPassword || !testPassword) {
    console.error(
      'Defina SEED_ADMIN_PASSWORD e SEED_TEST_PASSWORD (ou CREATE_USER_ADMIN_PASSWORD / CREATE_USER_TEST_PASSWORD) no ambiente.',
    );
    process.exit(1);
  }

  for (const [label, password] of [
    ['admin', adminPassword],
    ['teste', testPassword],
  ] as const) {
    const policyError = validatePassword(password);
    if (policyError) {
      console.error(`Senha de ${label} inválida: ${policyError}`);
      process.exit(1);
    }
  }

  try {
    console.log('Verificando usuários existentes...');

    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@sistema.com' },
    });

    if (existingAdmin) {
      const passwordMatch = await bcrypt.compare(adminPassword, existingAdmin.password);
      if (!passwordMatch) {
        const newHashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { password: newHashedPassword },
        });
        console.log('Senha do admin atualizada.');
      } else {
        console.log('Usuário admin já existe com senha correta.');
      }
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          email: 'admin@sistema.com',
          password: hashedPassword,
          name: 'Administrador',
          role: 'ADMIN',
          isActive: true,
        },
      });
      console.log('Usuário admin criado.');
    }

    const existingTest = await prisma.user.findUnique({
      where: { email: 'teste@sistema.com' },
    });

    if (existingTest) {
      const passwordMatch = await bcrypt.compare(testPassword, existingTest.password);
      if (!passwordMatch) {
        const newHashedPassword = await bcrypt.hash(testPassword, 10);
        await prisma.user.update({
          where: { id: existingTest.id },
          data: { password: newHashedPassword },
        });
        console.log('Senha do usuário de teste atualizada.');
      } else {
        console.log('Usuário de teste já existe com senha correta.');
      }
    } else {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      await prisma.user.create({
        data: {
          email: 'teste@sistema.com',
          password: hashedPassword,
          name: 'Usuário de Teste',
          role: 'AGENT',
          isActive: true,
        },
      });
      console.log('Usuário de teste criado.');
    }

    console.log('Credenciais configuradas via variáveis de ambiente (senhas não são exibidas).');
    await prisma.$disconnect();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Erro:', message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestUser();
