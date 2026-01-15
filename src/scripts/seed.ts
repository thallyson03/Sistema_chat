import prisma from '../config/database';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Verificar se já existe um admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      console.log('✅ Admin já existe no banco de dados');
      return;
    }

    // Criar usuário admin padrão
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@sistema.com',
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('📧 Email: admin@sistema.com');
    console.log('🔑 Senha: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');

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





