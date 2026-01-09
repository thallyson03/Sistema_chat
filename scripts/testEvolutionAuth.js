const axios = require('axios');

const EVOLUTION_URL = process.argv[2] || 'https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io';
const API_KEY = process.argv[3];

if (!API_KEY) {
  console.log('Uso: node scripts/testEvolutionAuth.js [URL] [API_KEY]');
  console.log('Exemplo: node scripts/testEvolutionAuth.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io sua_api_key');
  process.exit(1);
}

async function testAuth() {
  console.log('🔍 Testando diferentes formatos de autenticação...\n');
  console.log(`URL: ${EVOLUTION_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...\n`);

  // Teste 1: Header apikey
  console.log('Teste 1: Header "apikey"');
  try {
    const response = await axios.get(`${EVOLUTION_URL}/`, {
      headers: {
        'apikey': API_KEY,
      },
    });
    console.log('✅ SUCESSO com header "apikey"');
    console.log('Resposta:', response.data);
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Teste 2: Header Authorization Bearer
  console.log('\nTeste 2: Header "Authorization: Bearer {key}"');
  try {
    const response = await axios.get(`${EVOLUTION_URL}/`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    console.log('✅ SUCESSO com Authorization Bearer');
    console.log('Resposta:', response.data);
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Teste 3: Header Authorization direto
  console.log('\nTeste 3: Header "Authorization: {key}" (sem Bearer)');
  try {
    const response = await axios.get(`${EVOLUTION_URL}/`, {
      headers: {
        'Authorization': API_KEY,
      },
    });
    console.log('✅ SUCESSO com Authorization direto');
    console.log('Resposta:', response.data);
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Teste 4: Query parameter
  console.log('\nTeste 4: Query parameter "?apikey={key}"');
  try {
    const response = await axios.get(`${EVOLUTION_URL}/?apikey=${API_KEY}`);
    console.log('✅ SUCESSO com query parameter');
    console.log('Resposta:', response.data);
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status, error.response?.data?.message || error.message);
  }

  // Teste 5: X-API-Key
  console.log('\nTeste 5: Header "X-API-Key"');
  try {
    const response = await axios.get(`${EVOLUTION_URL}/`, {
      headers: {
        'X-API-Key': API_KEY,
      },
    });
    console.log('✅ SUCESSO com X-API-Key');
    console.log('Resposta:', response.data);
    return;
  } catch (error) {
    console.log('❌ Falhou:', error.response?.status, error.response?.data?.message || error.message);
  }

  console.log('\n❌ Nenhum formato funcionou. Verifique:');
  console.log('1. Se a API Key está correta');
  console.log('2. Se a URL está correta');
  console.log('3. Se a Evolution API está configurada para aceitar essa API Key');
}

testAuth();



