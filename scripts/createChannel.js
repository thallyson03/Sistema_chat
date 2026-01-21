const axios = require('axios');

const API_BASE = 'http://localhost:3007';
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_PASSWORD = 'admin123';

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

    // 2. Solicitar dados do canal
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (query) => {
      return new Promise((resolve) => {
        readline.question(query, resolve);
      });
    };

    console.log('📱 Configuração do Canal WhatsApp\n');
    const channelName = await askQuestion('Nome do canal (ex: WhatsApp Principal): ');
    const apiKey = await askQuestion('Evolution API Key: ');
    
    readline.close();

    console.log('\n🔄 Criando canal...');

    // 3. Criar canal
    const channelResponse = await axios.post(
      `${API_BASE}/api/channels`,
      {
        name: channelName || 'WhatsApp Principal',
        type: 'WHATSAPP',
        config: {},
        evolutionApiKey: apiKey,
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

    // 4. Obter QR Code
    console.log('📷 Obtendo QR Code...');
    const qrResponse = await axios.get(
      `${API_BASE}/api/channels/${channelId}/qrcode`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (qrResponse.data.qrcode) {
      console.log('✅ QR Code obtido!');
      console.log('\n📱 Para conectar:');
      console.log('1. Abra o WhatsApp no celular');
      console.log('2. Vá em Configurações > Aparelhos conectados > Conectar um aparelho');
      console.log('3. Use o QR Code abaixo (ou salve em um arquivo HTML)\n');
      
      // Criar HTML com QR Code
      const html = `
<!DOCTYPE html>
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
        }
        .container {
            text-align: center;
        }
        img {
            max-width: 400px;
            border: 2px solid #25D366;
            padding: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>QR Code WhatsApp</h1>
        <img src="${qrResponse.data.qrcode}" alt="QR Code" />
        <p>Escaneie este QR Code com o WhatsApp</p>
    </div>
</body>
</html>`;

      const fs = require('fs');
      fs.writeFileSync('qrcode.html', html);
      console.log('💾 QR Code salvo em: qrcode.html');
      console.log('   Abra este arquivo no navegador para ver o QR Code\n');
    } else {
      console.log('⚠️  QR Code ainda não disponível. Aguarde alguns segundos e execute:');
      console.log(`   GET ${API_BASE}/api/channels/${channelId}/qrcode`);
    }

    // 5. Verificar status
    console.log('\n🔍 Verificando status do canal...');
    const statusResponse = await axios.get(
      `${API_BASE}/api/channels/${channelId}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`📊 Status: ${statusResponse.data.status}`);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.error('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

createChannel();







