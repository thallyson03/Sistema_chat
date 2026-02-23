import prisma from '../config/database';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Criar usuário admin padrão
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@sistema.com' },
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
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

    // Criar usuário de teste (AGENT)
    let testUser = await prisma.user.findUnique({
      where: { email: 'teste@sistema.com' },
    });

    if (!testUser) {
      const hashedPassword = await bcrypt.hash('teste123', 10);
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

    console.log('');
    console.log('📋 Credenciais criadas:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 ADMIN:');
    console.log('   📧 Email: admin@sistema.com');
    console.log('   🔑 Senha: admin123');
    console.log('');
    console.log('👤 TESTE:');
    console.log('   📧 Email: teste@sistema.com');
    console.log('   🔑 Senha: teste123');
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
      await prisma.tag.create({
        data: tag,
      });
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







