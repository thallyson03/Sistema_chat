const axios = require('axios');

async function testChannelsAPI() {
  try {
    // Primeiro, vamos fazer login para obter o token
    console.log('🔐 Fazendo login...\n');
    const loginResponse = await axios.post('http://localhost:3007/api/auth/login', {
      email: 'admin@sistema.com',
      password: 'admin123',
    });

    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso!\n');

    // Agora vamos buscar os canais
    console.log('📡 Buscando canais via API...\n');
    const channelsResponse = await axios.get('http://localhost:3007/api/channels', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const channels = channelsResponse.data;
    console.log(`📊 Total de canais retornados pela API: ${channels.length}\n`);

    if (channels.length === 0) {
      console.log('⚠️ A API não retornou nenhum canal.');
      return;
    }

    channels.forEach((channel, index) => {
      console.log(`${index + 1}. Canal:`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Nome: "${channel.name}"`);
      console.log(`   Tipo: ${channel.type}`);
      console.log(`   Status: ${channel.status}`);
      console.log('');
    });

    // Verificar especificamente o canal "Principal"
    const principalChannel = channels.find(c => c.name === 'Principal' || c.name.includes('Principal'));
    if (principalChannel) {
      console.log('✅ Canal "Principal" encontrado na resposta da API!');
    } else {
      console.log('❌ Canal "Principal" NÃO encontrado na resposta da API.');
      console.log('Canais retornados:');
      channels.forEach(c => console.log(`  - "${c.name}"`));
    }

  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testChannelsAPI();


