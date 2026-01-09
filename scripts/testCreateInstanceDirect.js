const axios = require('axios');

const EVOLUTION_URL = process.argv[2] || 'https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io';
const API_KEY = process.argv[3];
const INSTANCE_NAME = process.argv[4] || `test-${Date.now()}`;

if (!API_KEY) {
  console.log('Uso: node scripts/testCreateInstanceDirect.js [URL] [API_KEY] [INSTANCE_NAME]');
  console.log('Exemplo: node scripts/testCreateInstanceDirect.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io sua_api_key minha-instancia');
  process.exit(1);
}

async function testCreateInstance() {
  console.log('🧪 Testando criação de instância na Evolution API...\n');
  console.log(`URL: ${EVOLUTION_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`Instance Name: ${INSTANCE_NAME}\n`);

  const requestData = {
    instanceName: INSTANCE_NAME,
    qrcode: true,
    integration: 'EVOLUTION',
    number: '5598985663013', // Opcional
  };

  // Teste 1: Header apikey (mais comum)
  console.log('═'.repeat(60));
  console.log('Teste 1: Header "apikey"');
  console.log('═'.repeat(60));
  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
        },
        timeout: 30000,
      }
    );
    console.log('✅ SUCESSO com header "apikey"!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status || error.code);
    console.log('Erro:', error.response?.data || error.message);
    if (error.response?.status !== 401) {
      console.log('\n⚠️ Erro diferente de 401 - pode ser problema de rede/IP');
      return;
    }
  }

  // Teste 2: Header Authorization Bearer
  console.log('\n═'.repeat(60));
  console.log('Teste 2: Header "Authorization: Bearer {key}"');
  console.log('═'.repeat(60));
  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 30000,
      }
    );
    console.log('✅ SUCESSO com Authorization Bearer!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status || error.code);
    console.log('Erro:', error.response?.data || error.message);
    if (error.response?.status !== 401) {
      console.log('\n⚠️ Erro diferente de 401 - pode ser problema de rede/IP');
      return;
    }
  }

  // Teste 3: Header Authorization Token
  console.log('\n═'.repeat(60));
  console.log('Teste 3: Header "Authorization: Token {key}"');
  console.log('═'.repeat(60));
  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${API_KEY}`,
        },
        timeout: 30000,
      }
    );
    console.log('✅ SUCESSO com Authorization Token!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status || error.code);
    console.log('Erro:', error.response?.data || error.message);
  }

  // Teste 4: X-API-Key
  console.log('\n═'.repeat(60));
  console.log('Teste 4: Header "X-API-Key"');
  console.log('═'.repeat(60));
  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        timeout: 30000,
      }
    );
    console.log('✅ SUCESSO com X-API-Key!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status || error.code);
    console.log('Erro:', error.response?.data || error.message);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('❌ TODOS OS TESTES FALHARAM');
  console.log('═'.repeat(60));
  console.log('\nPossíveis causas:');
  console.log('1. API Key incorreta ou inválida');
  console.log('2. API Key sem permissão para criar instâncias');
  console.log('3. URL da Evolution API incorreta');
  console.log('4. Evolution API bloqueando requisições de localhost');
  console.log('5. Formato de autenticação diferente do esperado');
  console.log('\n💡 Dica: Verifique no painel da Evolution API se:');
  console.log('   - A API Key está ativa');
  console.log('   - A API Key tem permissão para criar instâncias');
  console.log('   - Não há whitelist de IPs configurada');
}

testCreateInstance().catch(console.error);



