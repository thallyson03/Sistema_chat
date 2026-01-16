# 📱 Como Criar um Canal WhatsApp

## ✅ Passo a Passo

### 1. Reiniciar o Servidor (se ainda não reiniciou)

Para carregar as novas configurações do `.env`, você precisa reiniciar o servidor:

1. Pare o servidor atual (Ctrl+C no terminal onde está rodando)
2. Inicie novamente:
```bash
npm run dev:server
```

### 2. Obter seu Token de Autenticação

Faça login novamente para obter um novo token (se necessário):

```bash
POST http://localhost:3007/api/auth/login
{
  "email": "admin@sistema.com",
  "password": "admin123"
}
```

Copie o `token` da resposta.

### 3. Criar o Canal WhatsApp

**Opção A: Via API (Recomendado)**

```bash
curl -X POST http://localhost:3007/api/channels \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Principal",
    "type": "WHATSAPP",
    "config": {},
    "evolutionApiKey": "SUA_API_KEY_AQUI"
  }'
```

**Importante:** 
- Substitua `SEU_TOKEN_AQUI` pelo token recebido no login
- Substitua `SUA_API_KEY_AQUI` pela API Key da Evolution API

**Opção B: Via Interface (quando implementada)**
- Vá em "Canais" no menu
- Clique em "Criar Novo Canal"
- Preencha os dados

### 4. Obter o QR Code

Após criar o canal, você receberá um `id`. Use esse ID para obter o QR Code:

```bash
GET http://localhost:3007/api/channels/CANAL_ID/qrcode
```

A resposta conterá:
```json
{
  "qrcode": "data:image/png;base64,iVBORw0KGgo..."
}
```

### 5. Conectar o WhatsApp

1. Abra o WhatsApp no celular
2. Vá em **Configurações > Aparelhos conectados > Conectar um aparelho**
3. Escaneie o QR Code (você pode converter o base64 para imagem)
4. Aguarde a conexão

### 6. Verificar Status

Verifique se o canal está conectado:

```bash
GET http://localhost:3007/api/channels/CANAL_ID/status
```

Status esperado: `"ACTIVE"` quando conectado.

## 🔍 Testando

Após conectar:
1. Envie uma mensagem de teste para o número conectado
2. A mensagem deve aparecer automaticamente no sistema
3. Você pode responder através da API ou interface

## ⚠️ Problemas Comuns

### Erro: "Authentication failed"
- Verifique se a API Key está correta no `.env` e na criação do canal

### QR Code não aparece
- Verifique se o servidor está rodando
- Verifique os logs do servidor para erros

### Canal não conecta
- Verifique se a Evolution API está acessível
- Verifique se o webhook está configurado corretamente
- Veja os logs da Evolution API






