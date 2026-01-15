# 🧪 Teste Direto da Evolution API

Para identificar o formato correto de autenticação, vamos testar diretamente.

## Teste no Navegador (Console)

Abra o console do navegador (F12) e execute:

```javascript
// Substitua SUA_API_KEY pela sua API Key real
const API_KEY = 'SUA_API_KEY';

// Teste 1: Header apikey
fetch('https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/', {
  headers: {
    'apikey': API_KEY
  }
})
.then(r => r.json())
.then(d => console.log('✅ apikey funcionou:', d))
.catch(e => console.error('❌ apikey falhou:', e));

// Teste 2: Authorization Token
fetch('https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/', {
  headers: {
    'Authorization': `Token ${API_KEY}`
  }
})
.then(r => r.json())
.then(d => console.log('✅ Token funcionou:', d))
.catch(e => console.error('❌ Token falhou:', e));

// Teste 3: Authorization Bearer
fetch('https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
})
.then(r => r.json())
.then(d => console.log('✅ Bearer funcionou:', d))
.catch(e => console.error('❌ Bearer falhou:', e));
```

## Ou use o script Node

Execute:
```bash
node scripts/testEvolutionAuth.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io SUA_API_KEY
```

## O que fazer com o resultado

Quando identificar qual formato funciona, me avise e ajusto o código para usar o formato correto!





