/**
 * Script para testar a verificação do webhook do WhatsApp Official
 * 
 * Uso:
 * node test-webhook-verification.js
 */

const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 3007;
const VERIFY_TOKEN = process.env.WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

console.log('🔍 Testando configuração do webhook...\n');
console.log('📋 Configurações:');
console.log(`   - Porta do servidor: ${PORT}`);
console.log(`   - Verify Token configurado: ${VERIFY_TOKEN ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   - Token: ${VERIFY_TOKEN || '(não configurado)'}\n`);

if (!VERIFY_TOKEN) {
  console.error('❌ ERRO: WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN não está configurado no .env');
  console.log('\n💡 Solução:');
  console.log('   1. Abra o arquivo .env');
  console.log('   2. Adicione a linha:');
  console.log('      WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui');
  console.log('   3. Reinicie o servidor (npm run dev)\n');
  process.exit(1);
}

// Testar se o servidor está respondendo
const testUrl = `http://localhost:${PORT}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;

console.log('🧪 Testando endpoint local...');
console.log(`   URL: ${testUrl}\n`);

const req = http.get(testUrl, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📥 Resposta do servidor:');
    console.log(`   - Status: ${res.statusCode}`);
    console.log(`   - Body: ${data}\n`);
    
    if (res.statusCode === 200 && data === 'test123') {
      console.log('✅ SUCESSO! O webhook está funcionando corretamente.');
      console.log('\n📝 Próximos passos:');
      console.log('   1. Certifique-se de que o ngrok está rodando: ngrok http 3007');
      console.log('   2. Copie a URL HTTPS do ngrok (ex: https://abc123.ngrok-free.app)');
      console.log('   3. No Meta Developers, use:');
      console.log(`      URL: https://SUA_URL_NGROK.ngrok-free.app/api/webhooks/whatsapp`);
      console.log(`      Verify Token: ${VERIFY_TOKEN}`);
    } else if (res.statusCode === 403) {
      console.log('❌ ERRO: Token de verificação não confere!');
      console.log('   Verifique se o token no .env é exatamente o mesmo que você colocou no Meta.');
    } else {
      console.log('⚠️  Resposta inesperada. Verifique se o servidor está rodando.');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERRO ao conectar ao servidor:', error.message);
  console.log('\n💡 Verifique:');
  console.log('   1. O servidor está rodando? (npm run dev)');
  console.log(`   2. A porta ${PORT} está correta?`);
});

req.setTimeout(5000, () => {
  console.error('❌ Timeout: O servidor não respondeu em 5 segundos.');
  console.log('   Verifique se o servidor está rodando.');
  req.destroy();
});
