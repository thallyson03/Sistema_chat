const axios = require('axios');

const EVOLUTION_URL = process.argv[2] || 'https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io';
const API_KEY = process.argv[3];
const INSTANCE_NAME = `test_${Date.now()}`;

if (!API_KEY) {
  console.log('Uso: node scripts/testCreateInstance.js [URL] [API_KEY]');
  console.log('Exemplo: node scripts/testCreateInstance.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io sua_api_key');
  process.exit(1);
}

async function testCreateInstance() {
  console.log('🔍 Testando criação de instância na Evolution API...\n');
  console.log(`URL: ${EVOLUTION_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`Instance Name: ${INSTANCE_NAME}\n`);

  // Teste com header apikey
  console.log('Testando criação de instância...');
  try {
    const response = await axios.post(
      `${EVOLUTION_URL}/instance/create`,
      {
        instanceName: INSTANCE_NAME,
        qrcode: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY,
        },
      }
    );
    
    console.log('✅ SUCESSO!');
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ ERRO!');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Resposta:', JSON.stringify(error.response?.data, null, 2));
    console.log('\nHeaders enviados:', {
      'Content-Type': 'application/json',
      'apikey': `${API_KEY.substring(0, 10)}...`,
    });
    console.log('\nBody enviado:', {
      instanceName: INSTANCE_NAME,
      qrcode: true,
    });
  }
}

testCreateInstance();



