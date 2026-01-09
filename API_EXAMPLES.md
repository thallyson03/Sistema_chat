# Exemplos de Uso da API

Este documento contém exemplos práticos de como usar a API do sistema de atendimento.

## Autenticação

### Registrar Usuário

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agente@exemplo.com",
    "password": "senha123",
    "name": "João Silva",
    "role": "AGENT"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sistema.com",
    "password": "admin123"
  }'
```

**Resposta:**
```json
{
  "user": {
    "id": "...",
    "email": "admin@sistema.com",
    "name": "Administrador",
    "role": "ADMIN"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Obter Usuário Atual

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Canais

### Criar Canal WhatsApp

```bash
curl -X POST http://localhost:3001/api/channels \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Principal",
    "type": "WHATSAPP",
    "config": {},
    "evolutionApiKey": "sua_api_key_aqui"
  }'
```

### Listar Canais

```bash
curl -X GET http://localhost:3001/api/channels \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Obter QR Code do Canal

```bash
curl -X GET http://localhost:3001/api/channels/CANAL_ID/qrcode \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

**Resposta:**
```json
{
  "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### Verificar Status do Canal

```bash
curl -X GET http://localhost:3001/api/channels/CANAL_ID/status \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Conversas

### Listar Conversas

```bash
# Listar todas
curl -X GET http://localhost:3001/api/conversations \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Filtrar por status
curl -X GET "http://localhost:3001/api/conversations?status=OPEN" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Filtrar por canal
curl -X GET "http://localhost:3001/api/conversations?channelId=CANAL_ID" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Buscar por texto
curl -X GET "http://localhost:3001/api/conversations?search=João" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Paginação
curl -X GET "http://localhost:3001/api/conversations?limit=20&offset=0" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Obter Conversa Específica

```bash
curl -X GET http://localhost:3001/api/conversations/CONVERSA_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Atualizar Conversa

```bash
curl -X PUT http://localhost:3001/api/conversations/CONVERSA_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CLOSED",
    "priority": "HIGH"
  }'
```

### Atribuir Conversa

```bash
curl -X POST http://localhost:3001/api/conversations/CONVERSA_ID/assign \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID"
  }'
```

### Estatísticas

```bash
curl -X GET http://localhost:3001/api/conversations/stats \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

**Resposta:**
```json
{
  "total": 150,
  "open": 45,
  "waiting": 12,
  "closed": 93
}
```

### Contador de Não Lidas

```bash
curl -X GET http://localhost:3001/api/conversations/unread-count \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Mensagens

### Enviar Mensagem

```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "CONVERSA_ID",
    "content": "Olá! Como posso ajudar?",
    "type": "TEXT"
  }'
```

### Listar Mensagens de uma Conversa

```bash
curl -X GET http://localhost:3001/api/messages/conversation/CONVERSA_ID \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Com paginação
curl -X GET "http://localhost:3001/api/messages/conversation/CONVERSA_ID?limit=50&offset=0" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Marcar Conversa como Lida

```bash
curl -X PUT http://localhost:3001/api/messages/conversation/CONVERSA_ID/read \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Webhooks

### Webhook da Evolution API

O sistema expõe automaticamente um endpoint para receber eventos da Evolution API:

```
POST http://localhost:3001/webhooks/evolution
```

Este endpoint é configurado automaticamente quando você cria um canal WhatsApp. A Evolution API enviará eventos de mensagens para este endpoint.

## Exemplo Completo em JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';
let authToken = '';

// 1. Login
async function login(email: string, password: string) {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, {
    email,
    password,
  });
  authToken = response.data.token;
  return response.data;
}

// 2. Obter canais
async function getChannels() {
  const response = await axios.get(`${API_BASE_URL}/channels`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  return response.data;
}

// 3. Obter conversas
async function getConversations(filters = {}) {
  const response = await axios.get(`${API_BASE_URL}/conversations`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: filters,
  });
  return response.data;
}

// 4. Enviar mensagem
async function sendMessage(conversationId: string, content: string) {
  const response = await axios.post(
    `${API_BASE_URL}/messages`,
    {
      conversationId,
      content,
      type: 'TEXT',
    },
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );
  return response.data;
}

// 5. Obter mensagens
async function getMessages(conversationId: string) {
  const response = await axios.get(
    `${API_BASE_URL}/messages/conversation/${conversationId}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );
  return response.data;
}

// Uso
(async () => {
  await login('admin@sistema.com', 'admin123');
  const channels = await getChannels();
  const conversations = await getConversations({ status: 'OPEN' });
  
  if (conversations.conversations.length > 0) {
    const firstConversation = conversations.conversations[0];
    const messages = await getMessages(firstConversation.id);
    await sendMessage(firstConversation.id, 'Olá! Como posso ajudar?');
  }
})();
```

## Códigos de Status HTTP

- `200 OK` - Requisição bem-sucedida
- `201 Created` - Recurso criado com sucesso
- `400 Bad Request` - Dados inválidos
- `401 Unauthorized` - Token não fornecido ou inválido
- `403 Forbidden` - Sem permissão para realizar a ação
- `404 Not Found` - Recurso não encontrado
- `500 Internal Server Error` - Erro interno do servidor

## Formato de Erros

Quando uma requisição falha, a resposta seguirá este formato:

```json
{
  "error": "Mensagem de erro descritiva"
}
```



