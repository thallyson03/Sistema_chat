# 🔍 Diagnóstico do Erro 400 ao Criar Canal

## O que significa o erro 400?

Erro 400 (Bad Request) significa que:
- ✅ Sua autenticação está funcionando (passou do 403)
- ❌ Mas há um problema com os dados ou com a comunicação com a Evolution API

## Possíveis Causas:

### 1. Evolution API não está acessível
- Verifique se a URL da Evolution API está correta no `.env`
- Teste acessar: `https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/`

### 2. API Key incorreta
- A API Key pode estar errada ou expirada
- Verifique se está usando a API Key correta da Evolution API

### 3. Problema na criação da instância
- A Evolution API pode estar recusando criar a instância
- Pode ser que já exista uma instância com o mesmo nome

### 4. URL/Porta incorreta
- Verifique se `APP_URL` no `.env` está correto
- Deve ser: `http://localhost:3007` (ou a porta onde seu servidor está rodando)

## ✅ Como Diagnosticar:

### 1. Verificar Logs do Servidor

Olhe no terminal onde o servidor está rodando. Você deve ver mensagens como:
```
Criando instância instance_xxx na Evolution API...
Erro ao criar instância na Evolution API: [mensagem de erro]
```

### 2. Testar Evolution API Manualmente

Abra o console do navegador (F12) e execute:
```javascript
fetch('https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/', {
  headers: {
    'apikey': 'SUA_API_KEY_AQUI'
  }
})
.then(r => r.json())
.then(d => console.log('Evolution API:', d))
.catch(e => console.error('Erro:', e));
```

### 3. Verificar .env

Certifique-se de que o `.env` tem:
```env
EVOLUTION_API_URL=https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io
EVOLUTION_API_KEY=sua_api_key_aqui
APP_URL=http://localhost:3007
PORT=3007
```

### 4. Verificar Mensagem de Erro Específica

Quando tentar criar o canal, a mensagem de erro deve mostrar exatamente o que a Evolution API retornou.

## 🛠️ Soluções:

### Solução 1: Verificar se a Evolution API aceita a requisição

A Evolution API pode ter mudado o formato da requisição. Verifique a documentação em:
https://doc.evolution-api.com/

### Solução 2: Testar criação manual de instância

Use o Postman ou curl para testar criar uma instância diretamente na Evolution API:
```bash
curl -X POST https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/instance/create \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "teste123",
    "qrcode": true
  }'
```

### Solução 3: Verificar permissões da API Key

A API Key pode não ter permissão para criar instâncias.

## 📝 Próximos Passos:

1. **Olhe os logs do servidor** - deve mostrar o erro exato
2. **Verifique a mensagem de erro na interface** - agora mostra mais detalhes
3. **Teste a Evolution API diretamente** - use curl ou Postman
4. **Verifique a documentação da Evolution API** - pode ter mudado o formato

Agora as mensagens de erro são mais detalhadas. Tente criar o canal novamente e veja qual é a mensagem de erro específica!



