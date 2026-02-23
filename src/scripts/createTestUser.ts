import prisma from '../config/database';
import bcrypt from 'bcryptjs';

async function createTestUser() {
  try {
    console.log('🔍 Verificando usuários existentes...');

    // Verificar se já existe
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@sistema.com' },
    });

    if (existingAdmin) {
      console.log('✅ Usuário admin já existe!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Nome:', existingAdmin.name);
      console.log('🔐 Senha hash:', existingAdmin.password.substring(0, 20) + '...');
      console.log('✅ Ativo:', existingAdmin.isActive);
      
      // Testar comparação de senha
      const testPassword = 'admin123';
      const passwordMatch = await bcrypt.compare(testPassword, existingAdmin.password);
      console.log('🔑 Teste de senha "admin123":', passwordMatch ? '✅ CORRETO' : '❌ INCORRETO');
      
      if (!passwordMatch) {
        console.log('⚠️  Senha não confere! Recriando senha...');
        const newHashedPassword = await bcrypt.hash(testPassword, 10);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { password: newHashedPassword },
        });
        console.log('✅ Senha atualizada!');
      }
    } else {
      console.log('📝 Criando usuário admin...');
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
      console.log('📧 Email:', admin.email);
      console.log('🔑 Senha: admin123');
    }

    // Criar usuário de teste
    const existingTest = await prisma.user.findUnique({
      where: { email: 'teste@sistema.com' },
    });

    if (existingTest) {
      console.log('✅ Usuário de teste já existe!');
      const testPassword = 'teste123';
      const passwordMatch = await bcrypt.compare(testPassword, existingTest.password);
      console.log('🔑 Teste de senha "teste123":', passwordMatch ? '✅ CORRETO' : '❌ INCORRETO');
      
      if (!passwordMatch) {
        console.log('⚠️  Senha não confere! Recriando senha...');
        const newHashedPassword = await bcrypt.hash(testPassword, 10);
        await prisma.user.update({
          where: { id: existingTest.id },
          data: { password: newHashedPassword },
        });
        console.log('✅ Senha atualizada!');
      }
    } else {
      console.log('📝 Criando usuário de teste...');
      const hashedPassword = await bcrypt.hash('teste123', 10);
      
      const testUser = await prisma.user.create({
        data: {
          email: 'teste@sistema.com',
          password: hashedPassword,
          name: 'Usuário de Teste',
          role: 'AGENT',
          isActive: true,
        },
      });
      
      console.log('✅ Usuário de teste criado com sucesso!');
      console.log('📧 Email:', testUser.email);
      console.log('🔑 Senha: teste123');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CREDENCIAIS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 ADMIN:');
    console.log('   📧 Email: admin@sistema.com');
    console.log('   🔑 Senha: admin123');
    console.log('');
    console.log('👤 TESTE:');
    console.log('   📧 Email: teste@sistema.com');
    console.log('   🔑 Senha: teste123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestUser();

