const axios = require('axios');

// Configurações - ajuste conforme necessário
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'channel_1768486944796'; // Nome da instância
const INSTANCE_TOKEN = process.env.INSTANCE_TOKEN || 'AF1E8A6F-5DA0-4AAC-B900-7646E9A01264'; // Token da instância
const API_KEY = process.env.EVOLUTION_API_KEY;
if (!API_KEY) {
  console.error('Defina EVOLUTION_API_KEY no ambiente.');
  process.exit(1);
}
const WEBHOOK_URL = 'https://bronchially-unlimed-kemberly.ngrok-free.dev/webhooks/evolution';

console.log('🧪 ============================================');
console.log('🧪 TESTE DIRETO DE CONFIGURAÇÃO DE WEBHOOK');
console.log('🧪 ============================================');
console.log('URL da API:', EVOLUTION_API_URL);
console.log('Instância:', INSTANCE_NAME);
console.log('Token da Instância:', INSTANCE_TOKEN);
console.log('API Key Master:', API_KEY);
console.log('Webhook URL:', WEBHOOK_URL);
console.log('🧪 ============================================\n');

// Teste 1: Usando Token da Instância no header apikey
async function testWithInstanceToken() {
  console.log('📡 TESTE 1: Usando Token da Instância no header "apikey"');
  console.log('Endpoint: POST /webhook/set/' + INSTANCE_NAME);
  console.log('Header apikey:', INSTANCE_TOKEN);
  
  const payload1 = {
    enabled: true,
    url: WEBHOOK_URL,
    webhookByEvents: false,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_EDITED',
      'MESSAGES_DELETE',
      'SEND_MESSAGE',
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED',
      'PRESENCE_UPDATE',
    ],
  };

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      payload1,
      {
        headers: {
          'apikey': INSTANCE_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ SUCESSO! Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ ERRO! Status:', error.response?.status);
    console.log('Mensagem:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Teste 2: Usando API Key Master no header apikey
async function testWithApiKey() {
  console.log('\n📡 TESTE 2: Usando API Key Master no header "apikey"');
  console.log('Endpoint: POST /webhook/set/' + INSTANCE_NAME);
  console.log('Header apikey:', API_KEY);
  
  const payload2 = {
    enabled: true,
    url: WEBHOOK_URL,
    webhookByEvents: false,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_EDITED',
      'MESSAGES_DELETE',
      'SEND_MESSAGE',
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED',
      'PRESENCE_UPDATE',
    ],
  };

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      payload2,
      {
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ SUCESSO! Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ ERRO! Status:', error.response?.status);
    console.log('Mensagem:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Teste 3: Formato alternativo com webhook como objeto aninhado
async function testWithNestedWebhook() {
  console.log('\n📡 TESTE 3: Payload com webhook como objeto aninhado');
  console.log('Endpoint: POST /webhook/set/' + INSTANCE_NAME);
  console.log('Header apikey:', INSTANCE_TOKEN);
  
  const payload3 = {
    instance: {
      webhook: {
        enabled: true,
        url: WEBHOOK_URL,
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_EDITED',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'PRESENCE_UPDATE',
        ],
      },
    },
  };

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      payload3,
      {
        headers: {
          'apikey': INSTANCE_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ SUCESSO! Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ ERRO! Status:', error.response?.status);
    console.log('Mensagem:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Teste 4: Formato com instance no root
async function testWithInstanceRoot() {
  console.log('\n📡 TESTE 4: Payload com instance no root');
  console.log('Endpoint: POST /webhook/set/' + INSTANCE_NAME);
  console.log('Header apikey:', INSTANCE_TOKEN);
  
  const payload4 = {
    instance: INSTANCE_NAME,
    webhook: {
      enabled: true,
      url: WEBHOOK_URL,
      webhookByEvents: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'MESSAGES_EDITED',
        'MESSAGES_DELETE',
        'SEND_MESSAGE',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
        'PRESENCE_UPDATE',
      ],
    },
  };

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      payload4,
      {
        headers: {
          'apikey': INSTANCE_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ SUCESSO! Status:', response.status);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ ERRO! Status:', error.response?.status);
    console.log('Mensagem:', error.response?.data || error.message);
    if (error.response?.data) {
      console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Executar todos os testes
async function runTests() {
  console.log('🚀 Iniciando testes...\n');
  
  const results = {
    test1: await testWithInstanceToken(),
    test2: await testWithApiKey(),
    test3: await testWithNestedWebhook(),
    test4: await testWithInstanceRoot(),
  };

  console.log('\n📊 ============================================');
  console.log('📊 RESULTADOS DOS TESTES');
  console.log('📊 ============================================');
  console.log('Teste 1 (Token da Instância):', results.test1 ? '✅ PASSOU' : '❌ FALHOU');
  console.log('Teste 2 (API Key Master):', results.test2 ? '✅ PASSOU' : '❌ FALHOU');
  console.log('Teste 3 (Webhook aninhado):', results.test3 ? '✅ PASSOU' : '❌ FALHOU');
  console.log('Teste 4 (Instance no root):', results.test4 ? '✅ PASSOU' : '❌ FALHOU');
  console.log('📊 ============================================\n');

  const successCount = Object.values(results).filter(r => r).length;
  if (successCount > 0) {
    console.log(`✅ ${successCount} teste(s) passou(ram)!`);
  } else {
    console.log('❌ Nenhum teste passou. Verifique os erros acima.');
  }
}

runTests().catch(console.error);

