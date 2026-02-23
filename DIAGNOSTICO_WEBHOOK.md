# 🔍 Diagnóstico de Webhook WhatsApp Official

## Problema: Mensagens não estão chegando

Se você enviou uma mensagem mas não apareceu nenhum log no servidor, siga estes passos:

### 1. ✅ Verificar se o servidor está rodando

```bash
# Verifique se o servidor está ativo
# Você deve ver: "🚀 Servidor rodando na porta 3007"
```

### 2. ✅ Verificar se o ngrok está rodando

```bash
# O ngrok deve estar rodando e expondo a porta 3007
# Exemplo: https://seu-url.ngrok-free.dev
```

**Verificar URL do ngrok:**
- Acesse: http://localhost:4040 (interface do ngrok)
- Copie a URL HTTPS (ex: `https://xxxxx.ngrok-free.dev`)

### 3. ✅ Verificar configuração no Meta Developers

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu app
3. Vá em **WhatsApp > Configuração**
4. Verifique:
   - **URL de retorno de chamada (Callback URL)**: Deve ser `https://seu-url.ngrok-free.dev/api/webhooks/whatsapp`
   - **Token de verificação**: Deve ser o mesmo configurado no `.env` como `WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN`
   - **Campos de assinatura**: Deve incluir `messages` e `message_status`

### 4. ✅ Verificar variáveis de ambiente

No arquivo `.env`, verifique:

```env
WHATSAPP_ENV=dev
WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN=seu_token_aqui
WHATSAPP_DEV_TOKEN=seu_access_token
WHATSAPP_DEV_PHONE_NUMBER_ID=seu_phone_number_id
WHATSAPP_DEV_WABA_ID=seu_business_account_id
```

### 5. ✅ Testar webhook manualmente

**Teste GET (verificação):**
```bash
# Substitua YOUR_TOKEN pelo token configurado
curl "http://localhost:3007/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

**Teste POST (simular mensagem):**
```bash
curl -X POST http://localhost:3007/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511999999999",
            "phone_number_id": "PHONE_NUMBER_ID"
          },
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.xxx",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Teste"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

### 6. ✅ Verificar logs do servidor

Quando uma mensagem chega, você deve ver logs como:

```
📨 ============================================
📨 Webhook recebido do WhatsApp Official API
📨 Timestamp: ...
📨 Body completo: ...
📨 ============================================
```

**Se não aparecer nenhum log:**
- O webhook não está sendo chamado pelo Meta
- Verifique a URL no Meta Developers
- Verifique se o ngrok está rodando
- Verifique se há firewall bloqueando

### 7. ✅ Verificar se o webhook está ativo no Meta

1. No Meta Developers, vá em **WhatsApp > Configuração**
2. Verifique se o webhook está marcado como **"Verificado"** (ícone verde)
3. Se não estiver, clique em **"Verificar e salvar"**

### 8. ✅ Testar envio de mensagem de teste

No Meta Developers:
1. Vá em **WhatsApp > Configuração**
2. Role até **"Enviar mensagem de teste"**
3. Envie uma mensagem para o número configurado
4. Verifique os logs do servidor

### 9. ✅ Verificar porta do servidor

O servidor deve estar rodando na porta **3007** (padrão) ou na porta configurada em `PORT` no `.env`.

Verifique:
```bash
# No terminal do servidor, você deve ver:
🚀 Servidor rodando na porta 3007
📡 Webhooks disponíveis em http://localhost:3007/webhooks
```

### 10. ✅ Checklist rápido

- [ ] Servidor está rodando?
- [ ] ngrok está rodando e expondo a porta 3007?
- [ ] URL do webhook no Meta está correta?
- [ ] Token de verificação está correto?
- [ ] Webhook está marcado como "Verificado" no Meta?
- [ ] Variáveis de ambiente estão configuradas?
- [ ] Logs aparecem quando você testa manualmente?

## 🆘 Se ainda não funcionar

1. **Verifique os logs do ngrok**: Acesse http://localhost:4040 e veja se há requisições chegando
2. **Teste a URL diretamente**: Acesse `https://seu-url.ngrok-free.dev/health` no navegador
3. **Verifique firewall/antivírus**: Pode estar bloqueando conexões
4. **Reinicie o ngrok**: Pode ter mudado a URL
5. **Atualize a URL no Meta Developers**: Se o ngrok mudou, atualize no Meta

