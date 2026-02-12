const { execSync } = require('child_process');

console.log('🔄 Aplicando migration do Prisma...');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migration aplicada!');
} catch (error) {
  console.error('❌ Erro ao aplicar migration:', error.message);
  process.exit(1);
}

console.log('🔄 Regenerando Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma Client regenerado!');
} catch (error) {
  console.error('❌ Erro ao regenerar Prisma Client:', error.message);
  process.exit(1);
}

console.log('✅ Tudo pronto! Você pode reiniciar o servidor agora.');



