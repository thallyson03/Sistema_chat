const axios = require('axios');

// CONFIGURAÇÃO
const API_BASE = 'http://localhost:3007';
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_PASSWORD = 'admin123';
const CHANNEL_NAME = 'WhatsApp Official';

async function createWhatsAppOfficialChannel() {
  try {
    console.log('🔐 Fazendo login...');
    
    // 1. Login
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso!\n');

    // 2. Criar canal WhatsApp Official (sem Evolution API)
    console.log('🔄 Criando canal WhatsApp Official...');
    
    const channelData = {
      name: CHANNEL_NAME,
      type: 'WHATSAPP',
      config: {
        provider: 'whatsapp_official',
        phoneNumberId: process.env.WHATSAPP_DEV_PHONE_NUMBER_ID || '900916466447615',
        businessAccountId: process.env.WHATSAPP_DEV_WABA_ID || '761221229815247',
      },
    };
    
    console.log('📤 Dados do canal:', JSON.stringify(channelData, null, 2));
    
    const channelResponse = await axios.post(
      `${API_BASE}/api/channels`,
      channelData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const channelId = channelResponse.data.id;
    console.log('✅ Canal WhatsApp Official criado com sucesso!');
    console.log(`📋 ID do Canal: ${channelId}`);
    console.log(`📋 Nome: ${channelResponse.data.name}`);
    console.log(`📋 Status: ${channelResponse.data.status}`);
    console.log('\n✅ Pronto! Agora você pode testar enviando uma mensagem para o número de teste.');
    console.log('📱 Número de teste: +1 555 169 2364');
    console.log('📱 Seu número: +55 98 98566 3013');
    
  } catch (error) {
    console.error('❌ Erro ao criar canal:');
    console.error('   Mensagem:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

createWhatsAppOfficialChannel();

