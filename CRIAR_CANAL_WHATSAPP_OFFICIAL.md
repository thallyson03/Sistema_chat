# 📱 Criar Canal WhatsApp Official - Guia Rápido

## ✅ Método 1: Via Interface Web (Mais Fácil)

1. **Acesse:** http://localhost:3000/channels
2. **Clique em "Criar Novo Canal"** (ou botão similar)
3. **Preencha:**
   - **Nome:** "WhatsApp Official"
   - **Tipo:** "WHATSAPP"
   - **Deixe os campos de Evolution API vazios** (não precisa de API Key)
4. **Clique em "Salvar"**

## ✅ Método 2: Via API (Postman/Insomnia/curl)

### 1. Fazer Login

```bash
POST http://localhost:3007/api/auth/login
Content-Type: application/json

{
  "email": "admin@sistema.com",
  "password": "admin123"
}
```

**Copie o `token` da resposta.**

### 2. Criar Canal

```bash
POST http://localhost:3007/api/channels
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "name": "WhatsApp Official",
  "type": "WHATSAPP",
  "config": {
    "provider": "whatsapp_official"
  }
}
```

**Importante:** Não envie `evolutionApiKey` no body!

## ✅ Método 3: Via Script Node.js

Se você tiver Node.js no PATH:

```bash
node scripts/createWhatsAppOfficialChannel.js
```

## 🔍 Verificar se Foi Criado

1. Acesse: http://localhost:3000/channels
2. Você deve ver o canal "WhatsApp Official" na lista

## 🧪 Testar

Após criar o canal:

1. **Reinicie o servidor** (se ainda não reiniciou):
   ```bash
   npm run dev
   ```

2. **Envie uma mensagem de teste:**
   - Do seu WhatsApp (+55 98 98566 3013)
   - Para o número de teste (+1 555 169 2364)

3. **Verifique os logs** - você deve ver:
   ```
   📨 Webhook recebido do WhatsApp Official API
   [WhatsAppOfficial] ✅ Canal WhatsApp encontrado: ...
   [WhatsAppOfficial] ✅ Mensagem salva: ...
   ```

4. **Verifique no sistema:**
   - Acesse: http://localhost:3000/conversations
   - A mensagem deve aparecer

## ⚠️ Problemas Comuns

### Erro: "Nome e tipo são obrigatórios"
- Certifique-se de enviar `name` e `type` no body

### Erro: "Token inválido"
- Faça login novamente e copie o token atualizado

### Canal não aparece na lista
- Recarregue a página
- Verifique se o servidor está rodando

