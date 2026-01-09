# 🚀 Criar Canal WhatsApp - Método Rápido

## Opção 1: Usando o Script (Recomendado)

Execute o script passando sua API Key como argumento:

```bash
node scripts/createChannelSimple.js SUA_API_KEY_AQUI
```

**Exemplo:**
```bash
node scripts/createChannelSimple.js minha_api_key_123456
```

O script irá:
1. ✅ Fazer login automaticamente
2. ✅ Criar o canal WhatsApp
3. ✅ Gerar o QR Code
4. ✅ Salvar o QR Code em `qrcode.html`

Depois, abra o arquivo `qrcode.html` no navegador e escaneie com o WhatsApp!

---

## Opção 2: Via API Manual

Se preferir fazer manualmente:

### 1. Fazer Login
```bash
curl -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sistema.com","password":"admin123"}'
```

Copie o `token` da resposta.

### 2. Criar Canal
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

Copie o `id` do canal da resposta.

### 3. Obter QR Code
```bash
curl -X GET http://localhost:3007/api/channels/CANAL_ID/qrcode \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

A resposta conterá o QR Code em base64.

### 4. Verificar Status
```bash
curl -X GET http://localhost:3007/api/channels/CANAL_ID/status \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## 📱 Conectar WhatsApp

1. Abra o arquivo `qrcode.html` no navegador (ou use o QR Code base64)
2. No WhatsApp do celular, vá em:
   - **Configurações** > **Aparelhos conectados** > **Conectar um aparelho**
3. Escaneie o QR Code
4. Aguarde a conexão

---

## ✅ Verificar se Está Conectado

O status deve mudar de `INACTIVE` para `ACTIVE` quando conectar.

Para verificar:
```bash
GET http://localhost:3007/api/channels/CANAL_ID/status
```



