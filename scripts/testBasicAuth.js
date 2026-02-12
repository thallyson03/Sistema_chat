const axios = require('axios');

const EVOLUTION_URL = process.argv[2] || 'https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io';
const API_KEY = process.argv[3];

if (!API_KEY) {
  console.log('Uso: node scripts/testBasicAuth.js [URL] [API_KEY]');
  process.exit(1);
}

async function testBasicAuth() {
  console.log('🔍 Testando autenticação básica (endpoints simples)...\n');
  console.log(`URL: ${EVOLUTION_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 15)}...\n`);

  const endpoints = [
    { path: '/', method: 'GET', description: 'Root endpoint' },
    { path: '/instance/fetchInstances', method: 'GET', description: 'Listar instâncias' },
    { path: '/instance/fetchInstances?instanceName=test', method: 'GET', description: 'Buscar instância específica' },
  ];

  const authFormats = [
    { name: 'apikey', header: { 'apikey': API_KEY } },
    { name: 'Authorization: Bearer', header: { 'Authorization': `Bearer ${API_KEY}` } },
    { name: 'Authorization: Token', header: { 'Authorization': `Token ${API_KEY}` } },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`Endpoint: ${endpoint.method} ${endpoint.path}`);
    console.log(`Descrição: ${endpoint.description}`);
    console.log('═'.repeat(70));

    for (const auth of authFormats) {
      try {
        const config = {
          method: endpoint.method.toLowerCase(),
          url: `${EVOLUTION_URL}${endpoint.path}`,
          headers: {
            'Content-Type': 'application/json',
            ...auth.header,
          },
          timeout: 10000,
        };

        const response = await axios(config);
        
        console.log(`\n✅ SUCESSO com "${auth.name}"!`);
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.data, null, 2));
        console.log(`\n🎉 API Key funciona! Use o formato: ${auth.name}`);
        return { success: true, format: auth.name };
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`❌ 401 com "${auth.name}"`);
        } else if (error.response?.status === 404) {
          console.log(`⚠️  404 com "${auth.name}" (endpoint não existe, mas auth pode estar OK)`);
        } else {
          console.log(`❌ ${error.response?.status || error.code} com "${auth.name}": ${error.message}`);
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('❌ NENHUM TESTE FUNCIONOU');
  console.log('═'.repeat(70));
  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('\n1. Verifique no painel da Evolution API:');
  console.log('   URL: https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/manager');
  console.log('   - API Key está ativa?');
  console.log('   - API Key tem permissões corretas?');
  console.log('   - Há whitelist de IPs configurada?');
  console.log('\n2. Verifique se a API Key está correta:');
  console.log('   - Copie a API Key diretamente do painel');
  console.log('   - Certifique-se de não ter espaços ou caracteres extras');
  console.log('\n3. Descubra seu IP público:');
  console.log('   PowerShell: Invoke-RestMethod -Uri "https://api.ipify.org?format=json"');
  console.log('   Adicione seu IP na whitelist se necessário');
  console.log('\n4. Verifique a documentação da sua versão da Evolution API');
  
  return { success: false };
}

testBasicAuth().catch(console.error);







