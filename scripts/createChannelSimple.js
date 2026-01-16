const axios = require('axios');

// CONFIGURAÇÃO - Edite aqui
const API_BASE = 'http://localhost:3007';
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_PASSWORD = 'admin123';
const CHANNEL_NAME = 'WhatsApp Principal';
const EVOLUTION_API_KEY = process.argv[2] || 'COLOQUE_SUA_API_KEY_AQUI';

if (EVOLUTION_API_KEY === 'COLOQUE_SUA_API_KEY_AQUI') {
  console.log('❌ Erro: Você precisa fornecer a API Key como argumento!');
  console.log('\nUso:');
  console.log('  node scripts/createChannelSimple.js SUA_API_KEY_AQUI');
  console.log('\nOu edite o arquivo e coloque a API Key na variável EVOLUTION_API_KEY');
  process.exit(1);
}

async function createChannel() {
  try {
    console.log('🔐 Fazendo login...');
    
    // 1. Login
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso!\n');

    // 2. Criar canal
    console.log('🔄 Criando canal...');
    const channelResponse = await axios.post(
      `${API_BASE}/api/channels`,
      {
        name: CHANNEL_NAME,
        type: 'WHATSAPP',
        config: {},
        evolutionApiKey: EVOLUTION_API_KEY,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const channelId = channelResponse.data.id;
    console.log('✅ Canal criado com sucesso!');
    console.log(`📋 ID do Canal: ${channelId}\n`);

    // Aguardar um pouco para a instância ser criada
    console.log('⏳ Aguardando instância ser criada...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Obter QR Code
    console.log('📷 Obtendo QR Code...');
    try {
      const qrResponse = await axios.get(
        `${API_BASE}/api/channels/${channelId}/qrcode`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (qrResponse.data.qrcode) {
        console.log('✅ QR Code obtido!\n');
        
        // Criar HTML com QR Code
        const fs = require('fs');
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>QR Code WhatsApp</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f0f0f0;
        }
        .container {
            text-align: center;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        img {
            max-width: 400px;
            border: 2px solid #25D366;
            padding: 10px;
            border-radius: 5px;
        }
        h1 {
            color: #25D366;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 QR Code WhatsApp</h1>
        <img src="${qrResponse.data.qrcode}" alt="QR Code" />
        <p>1. Abra o WhatsApp no celular</p>
        <p>2. Vá em <strong>Configurações > Aparelhos conectados > Conectar um aparelho</strong></p>
        <p>3. Escaneie este QR Code</p>
    </div>
</body>
</html>`;

        fs.writeFileSync('qrcode.html', html);
        console.log('💾 QR Code salvo em: qrcode.html');
        console.log('   Abra este arquivo no navegador para ver o QR Code\n');
      }
    } catch (qrError) {
      console.log('⚠️  QR Code ainda não disponível. Aguarde alguns segundos.');
      console.log(`   Execute: curl -H "Authorization: Bearer ${token.substring(0, 20)}..." ${API_BASE}/api/channels/${channelId}/qrcode\n`);
    }

    // 4. Verificar status
    console.log('🔍 Verificando status do canal...');
    try {
      const statusResponse = await axios.get(
        `${API_BASE}/api/channels/${channelId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(`📊 Status: ${statusResponse.data.status}\n`);
    } catch (statusError) {
      console.log('⚠️  Não foi possível verificar o status\n');
    }

    console.log('🎉 Concluído!');
    console.log(`\n📋 Informações do Canal:`);
    console.log(`   ID: ${channelId}`);
    console.log(`   Nome: ${CHANNEL_NAME}`);
    console.log(`   Status: Aguardando conexão\n`);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.error('\nDetalhes:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

createChannel();






