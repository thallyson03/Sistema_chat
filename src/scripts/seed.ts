import prisma from '../config/database';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const testPassword = process.env.SEED_TEST_PASSWORD;

    if (!adminPassword || adminPassword.length < 12) {
      throw new Error(
        'Defina SEED_ADMIN_PASSWORD com no mínimo 12 caracteres para executar o seed.',
      );
    }

    // Criar usuário admin padrão
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@sistema.com' },
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin = await prisma.user.create({
        data: {
          email: 'admin@sistema.com',
          password: hashedPassword,
          name: 'Administrador',
          role: 'ADMIN',
          isActive: true,
        },
      });
      console.log('✅ Usuário admin criado com sucesso!');
    } else {
      console.log('ℹ️  Usuário admin já existe');
    }

    // Criar usuário de teste (AGENT) — opcional
    if (testPassword && testPassword.length >= 12) {
      let testUser = await prisma.user.findUnique({
        where: { email: 'teste@sistema.com' },
      });

      if (!testUser) {
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        testUser = await prisma.user.create({
          data: {
            email: 'teste@sistema.com',
            password: hashedPassword,
            name: 'Usuário de Teste',
            role: 'AGENT',
            isActive: true,
          },
        });
        console.log('✅ Usuário de teste criado com sucesso!');
      } else {
        console.log('ℹ️  Usuário de teste já existe');
      }
    } else {
      console.log('ℹ️  Usuário de teste ignorado (defina SEED_TEST_PASSWORD para criar)');
    }

    console.log('');
    console.log('📋 Credenciais:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 ADMIN: admin@sistema.com (senha = SEED_ADMIN_PASSWORD)');
    if (testPassword) {
      console.log('👤 TESTE: teste@sistema.com (senha = SEED_TEST_PASSWORD)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere as senhas após o primeiro login!');

    // Criar algumas tags de exemplo
    const tags = [
      { name: 'Urgente', color: '#ef4444', description: 'Requisições urgentes' },
      { name: 'Venda', color: '#10b981', description: 'Conversas de venda' },
      { name: 'Suporte', color: '#3b82f6', description: 'Suporte técnico' },
      { name: 'Financeiro', color: '#f59e0b', description: 'Questões financeiras' },
    ];

    for (const tag of tags) {
      const existing = await prisma.tag.findFirst({ where: { name: tag.name } });
      if (!existing) {
        await prisma.tag.create({ data: tag });
      }
    }

    console.log('✅ Tags de exemplo criadas');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erro ao executar seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seed();
