const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

if (!EVOLUTION_API_URL || !API_KEY) {
  console.error('Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente.');
  process.exit(1);
}

async function listInstances() {
  try {
    console.log('📋 Listando instâncias disponíveis...\n');
    
    const response = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      {
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const instances = Array.isArray(response.data) ? response.data : [response.data];
    
    console.log(`✅ Encontradas ${instances.length} instância(s):\n`);
    
    instances.forEach((inst, idx) => {
      const name = inst.name || inst.instanceName || 'SEM_NOME';
      const status = inst.connectionStatus || inst.status || 'SEM_STATUS';
      const token = inst.token || 'SEM_TOKEN';
      
      console.log(`${idx + 1}. Nome: ${name}`);
      console.log(`   Status: ${status}`);
      console.log(`   Token: ${token.substring(0, 20)}...`);
      console.log('');
    });

    // Retornar a primeira instância conectada ou a primeira disponível
    const connectedInstance = instances.find(inst => 
      (inst.connectionStatus || inst.status || '').toLowerCase() === 'open'
    );
    
    if (connectedInstance) {
      const name = connectedInstance.name || connectedInstance.instanceName;
      const token = connectedInstance.token;
      console.log('✅ Instância conectada encontrada para teste:');
      console.log(`   Nome: ${name}`);
      console.log(`   Token: ${token}`);
      return { name, token };
    } else if (instances.length > 0) {
      const first = instances[0];
      const name = first.name || first.instanceName;
      const token = first.token;
      console.log('⚠️ Nenhuma instância conectada. Usando a primeira disponível:');
      console.log(`   Nome: ${name}`);
      console.log(`   Token: ${token || 'N/A'}`);
      return { name, token };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao listar instâncias:', error.response?.data || error.message);
    return null;
  }
}

listInstances().then(result => {
  if (result) {
    console.log('\n💡 Use estes valores no teste:');
    console.log(`   INSTANCE_NAME="${result.name}"`);
    console.log(`   INSTANCE_TOKEN="${result.token}"`);
  }
});



