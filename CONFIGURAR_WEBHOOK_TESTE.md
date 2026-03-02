# 📡 Como Configurar o Webhook do WhatsApp Official (Ambiente de Teste)

## 🎯 Localização no Meta Developers

1. **Acesse:** https://developers.facebook.com/apps/1229018055851961/whatsapp/configuration
   
   Ou navegue manualmente:
   - Meta Developers → Seu App → **WhatsApp** (menu lateral)
   - Clique em **"Configuração"** (Configuration)

## 📝 Passo a Passo

### 1. Preparar o Servidor Local

Antes de configurar o webhook, você precisa expor seu servidor local:

```bash
# Instalar ngrok (se ainda não tiver)
# Windows: choco install ngrok
# Mac: brew install ngrok  
# Linux: https://ngrok.com/download

# Expor porta 3007 (ou a porta do seu servidor)
ngrok http 3007
```

**Copie a URL HTTPS gerada** (exemplo: `https://1234abcd.ngrok.io`)

### 2. Configurar Variáveis de Ambiente

No seu arquivo `.env`, adicione:

```env
# WhatsApp Official API - Desenvolvimento
WHATSAPP_DEV_TOKEN="seu-token-temporario"
WHATSAPP_DEV_PHONE_NUMBER_ID="900916466447615"
WHATSAPP_DEV_WABA_ID="761221229815247"
WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN="meu_token_secreto_123"  # ← Crie um token secreto aqui

# Ambiente
WHATSAPP_ENV="dev"

# NGROK (use a URL que você copiou)
NGROK_URL="https://1234abcd.ngrok.io"
```

**⚠️ IMPORTANTE:** O `WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN` é um token que **você mesmo cria** (pode ser qualquer string segura). Use o mesmo valor no Meta Developers e no `.env`.

### 3. Configurar Webhook no Meta Developers

1. **Acesse a página de Configuração:**
   - https://developers.facebook.com/apps/1229018055851961/whatsapp/configuration

2. **Role até a seção "Webhook":**

3. **Clique em "Editar" ou "Configurar"** ao lado de Webhook

4. **Preencha os campos:**
   - **Callback URL:** 
     ```
     https://seu-ngrok-url.ngrok.io/api/webhooks/whatsapp
     ```
     (Substitua `seu-ngrok-url.ngrok.io` pela URL do seu ngrok)
   
   - **Verify token:**
     ```
     meu_token_secreto_123
     ```
     (O mesmo valor que você colocou no `.env`)

5. **Clique em "Verify and Save"**
   - O Meta vai fazer uma requisição GET para verificar o webhook
   - Você deve ver no console do servidor:
     ```
     [WebhookWhatsApp] 🔐 Verificação do webhook: ...
     [WebhookWhatsApp] ✅ Webhook verificado com sucesso!
     ```

6. **Selecione os campos do Webhook:**
   - Marque ✅ `messages` (para receber mensagens)
   - Marque ✅ `message_status` (para receber status de entrega/leitura)

7. **Salve as alterações**

### 4. Verificar se Está Funcionando

1. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

2. **Verifique os logs:**
   - Você deve ver: `[WhatsAppOfficial] ✅ Serviço inicializado`

3. **Envie uma mensagem de teste:**
   - Do seu WhatsApp pessoal (+55 98 98566 3013) para o número de teste (+1 555 169 2364)
   - Você deve ver nos logs:
     ```
     [WhatsAppOfficial] 📩 Processando mensagem: ...
     [WhatsAppOfficial] ✅ Mensagem salva: ...
     ```

## 🔍 Troubleshooting

### Webhook não está sendo verificado
- ✅ Verifique se o servidor está rodando
- ✅ Confirme que o ngrok está ativo e acessível
- ✅ Verifique se o `verify_token` está **exatamente igual** no `.env` e no Meta Developers
- ✅ Veja os logs do servidor para identificar o erro

### Mensagens não estão chegando
- ✅ Verifique se os campos `messages` e `message_status` estão marcados
- ✅ Confirme que o webhook está "Ativado" (toggle azul)
- ✅ Verifique os logs do servidor
- ✅ Teste enviando uma mensagem do seu número de teste

### Erro 403 Forbidden
- ✅ O `verify_token` não está correto
- ✅ Verifique se está usando HTTPS (ngrok fornece HTTPS)

## 📍 URLs Importantes

- **Configuração do Webhook:** https://developers.facebook.com/apps/1229018055851961/whatsapp/configuration
- **Testes de API:** https://developers.facebook.com/apps/1229018055851961/whatsapp/use_cases/customize/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING
- **Getting Started:** https://developers.facebook.com/apps/1229018055851961/whatsapp/getting-started

## ✅ Checklist

- [ ] ngrok rodando e URL copiada
- [ ] Variáveis de ambiente configuradas no `.env`
- [ ] Servidor rodando (`npm run dev`)
- [ ] Webhook configurado no Meta Developers
- [ ] Verify token igual no `.env` e no Meta
- [ ] Campos `messages` e `message_status` marcados
- [ ] Webhook verificado com sucesso (logs mostram ✅)
- [ ] Mensagem de teste enviada e recebida



