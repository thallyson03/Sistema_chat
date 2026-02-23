# 🔧 Solução: Webhook não está chegando ao servidor

## ⚠️ Problema Identificado

O Meta está recebendo a mensagem (aparece no log do Meta Developers), mas o servidor não está recebendo o webhook. Isso geralmente acontece por causa do **ngrok free tier** que tem uma página intermediária (interstitial page).

## ✅ Soluções

### Solução 1: Usar ngrok com bypass do interstitial (Recomendado)

O ngrok free tier mostra uma página de aviso antes de permitir acesso. Para webhooks, isso pode causar problemas.

**Opção A: Usar ngrok authtoken (gratuito)**
```bash
# 1. Crie uma conta gratuita no ngrok: https://dashboard.ngrok.com/signup
# 2. Copie seu authtoken do dashboard
# 3. Configure:
ngrok config add-authtoken SEU_TOKEN_AQUI

# 4. Inicie o ngrok:
ngrok http 3007
```

**Opção B: Usar header para bypass (se disponível)**
Alguns planos do ngrok permitem bypass com header. Verifique no dashboard do ngrok.

### Solução 2: Verificar se o ngrok está encaminhando

1. **Acesse o ngrok inspector**: http://localhost:4040
2. **Envie uma mensagem de teste**
3. **Verifique se aparece uma requisição POST** para `/api/webhooks/whatsapp`
4. Se não aparecer, o Meta não está chamando o webhook

### Solução 3: Verificar URL no Meta Developers

A URL deve ser **exatamente**:
```
https://bronchially-unlimed-kemberly.ngrok-free.dev/api/webhooks/whatsapp
```

**Verifique:**
- ✅ Sem barra no final
- ✅ Protocolo HTTPS (não HTTP)
- ✅ Caminho completo: `/api/webhooks/whatsapp`

### Solução 4: Testar webhook manualmente

**Teste GET (verificação):**
```bash
curl "https://bronchially-unlimed-kemberly.ngrok-free.dev/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=test123"
```

**Teste POST (simular mensagem):**
```bash
curl -X POST https://bronchially-unlimed-kemberly.ngrok-free.dev/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "761221229815247",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15551692364",
            "phone_number_id": "900916466447615"
          },
          "messages": [{
            "from": "559885663013",
            "id": "wamid.test",
            "timestamp": "1771534701",
            "type": "text",
            "text": {
              "body": "TESTE"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

### Solução 5: Adicionar header para bypass do ngrok

Se o ngrok estiver bloqueando, você pode tentar adicionar um header. No Meta Developers, isso não é possível diretamente, mas você pode:

1. **Usar ngrok autenticado** (melhor opção)
2. **Usar um domínio próprio** com SSL
3. **Usar um serviço de túnel alternativo** (ex: Cloudflare Tunnel, localtunnel)

## 🔍 Diagnóstico Passo a Passo

### 1. Verificar se o servidor está recebendo requisições

Quando você acessa a URL no navegador e vê "Forbidden", isso é **normal** - significa que o endpoint está ativo.

### 2. Verificar logs do servidor

Quando o Meta tenta chamar o webhook, você deve ver:
```
📥 [Server] Requisição recebida: { method: 'POST', path: '/api/webhooks/whatsapp' }
📨 Webhook recebido do WhatsApp Official API
```

**Se não aparecer:**
- O Meta não está conseguindo chamar o webhook
- Pode ser bloqueado pelo ngrok
- Pode ser URL incorreta

### 3. Verificar ngrok inspector

Acesse: http://localhost:4040

Você deve ver:
- Requisições GET para verificação
- Requisições POST quando mensagens chegam

**Se não aparecer nada:**
- O Meta não está chamando o webhook
- Verifique a URL no Meta Developers

### 4. Verificar se o webhook está verificado

No Meta Developers:
- O webhook deve estar marcado como **"Verificado"** (ícone verde)
- Os campos `messages` e `message_status` devem estar **"Assinados"**

## 🚀 Solução Rápida

1. **Configure ngrok autenticado** (gratuito):
   ```bash
   ngrok config add-authtoken SEU_TOKEN
   ngrok http 3007
   ```

2. **Atualize a URL no Meta Developers** com a nova URL do ngrok

3. **Verifique e salve** o webhook no Meta

4. **Teste enviando uma mensagem**

5. **Verifique os logs** do servidor e do ngrok

## ⚠️ Importante

O erro "Forbidden" ao acessar a URL no navegador é **normal** e **esperado**. O webhook GET só funciona com os parâmetros corretos do Meta.

O problema real é que o **POST do Meta não está chegando ao servidor**. Isso geralmente é causado pelo ngrok free tier bloqueando requisições.

