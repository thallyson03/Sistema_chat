# Configuração do WhatsApp Official API

Este guia explica como configurar a integração com a API oficial do WhatsApp (Meta Cloud API) para desenvolvimento e produção.

## 📋 Pré-requisitos

1. **Conta Business Manager do Meta** criada e verificada
2. **App criado** no Meta Developers (https://developers.facebook.com)
3. **Produto WhatsApp** adicionado ao app
4. **Número de teste** configurado (para desenvolvimento)

## 🔧 Configuração Inicial

### 1. Obter Credenciais no Meta Developers

1. Acesse https://developers.facebook.com/apps
2. Selecione seu app
3. Vá em **WhatsApp > Getting Started**
4. Copie as seguintes informações:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Temporary Access Token** (para desenvolvimento)

### 2. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env`:

```env
# WhatsApp Official API - Desenvolvimento
WHATSAPP_DEV_TOKEN="seu-token-temporario-aqui"
WHATSAPP_DEV_PHONE_NUMBER_ID="900916466447615"
WHATSAPP_DEV_WABA_ID="761221229815247"
WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN="seu-token-secreto-aqui"

# Ambiente (dev ou prod)
WHATSAPP_ENV="dev"

# NGROK (para desenvolvimento - expor localhost)
NGROK_URL="https://seu-ngrok-url.ngrok.io"
```

**⚠️ IMPORTANTE:** 
- O token temporário expira em algumas horas. Para produção, você precisará de um token permanente.
- O `WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN` é um token que você mesmo cria (pode ser qualquer string segura).

### 3. Configurar Webhook no Meta Developers

1. No Meta Developers, vá em **WhatsApp > Configuration**
2. Em **Webhook**, clique em **Edit**
3. Configure:
   - **Callback URL**: `https://seu-ngrok-url.ngrok.io/api/webhooks/whatsapp`
   - **Verify token**: O mesmo valor de `WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN` do `.env`
4. Clique em **Verify and Save**
5. Em **Webhook fields**, marque:
   - ✅ `messages`
   - ✅ `message_status`

### 4. Expor Servidor Local (Desenvolvimento)

Para desenvolvimento, você precisa expor seu servidor local usando **ngrok**:

```bash
# Instalar ngrok (se ainda não tiver)
# Windows: choco install ngrok
# Mac: brew install ngrok
# Linux: https://ngrok.com/download

# Expor porta 3007 (ou a porta do seu servidor)
ngrok http 3007
```

Copie a URL HTTPS gerada (ex: `https://1234abcd.ngrok.io`) e:
1. Adicione no `.env` como `NGROK_URL`
2. Use essa URL no webhook do Meta Developers

## 🚀 Testando a Integração

### 1. Iniciar o Servidor

```bash
npm run dev
```

### 2. Verificar Webhook

O Meta vai fazer uma requisição GET para verificar o webhook. Você deve ver no console:

```
[WebhookWhatsApp] 🔐 Verificação do webhook: ...
[WebhookWhatsApp] ✅ Webhook verificado com sucesso!
```

### 3. Enviar Mensagem de Teste

Envie uma mensagem do seu WhatsApp pessoal para o número de teste. Você deve ver:

```
[WhatsAppOfficial] 📩 Processando mensagem: ...
[WhatsAppOfficial] ✅ Mensagem salva: ...
```

### 4. Testar Resposta do Bot

Se você tiver um bot configurado, ele deve responder automaticamente.

## 📝 Estrutura de Arquivos Criados

- `src/services/whatsappOfficialService.ts` - Serviço para comunicação com a API oficial
- `src/config/whatsappOfficial.ts` - Configuração e inicialização do serviço
- `src/routes/webhookRoutes.ts` - Rotas de webhook (GET e POST)

## 🔄 Migração para Produção

Quando estiver pronto para produção:

1. **Obter Token Permanente:**
   - Configure um sistema de renovação de token (System User Token)
   - Ou use tokens de longa duração

2. **Atualizar Variáveis de Ambiente:**
   ```env
   WHATSAPP_ENV="prod"
   WHATSAPP_TOKEN="seu-token-permanente"
   WHATSAPP_PHONE_NUMBER_ID="seu-phone-number-id"
   WHATSAPP_WABA_ID="seu-waba-id"
   WHATSAPP_WEBHOOK_VERIFY_TOKEN="seu-token-secreto"
   ```

3. **Configurar Webhook de Produção:**
   - Use a URL do seu servidor de produção (HTTPS obrigatório)
   - Configure o mesmo verify token

4. **Aprovar Templates:**
   - Crie e aprove templates no Meta Business Manager
   - Templates são obrigatórios para mensagens fora da janela de 24h

## ⚠️ Limitações e Considerações

- **Janela de 24h:** Mensagens do cliente abrem uma janela de 24h para respostas livres
- **Templates:** Fora da janela, só é possível enviar templates aprovados
- **Rate Limits:** A API tem limites de requisições por segundo
- **Tokens Temporários:** Expirem em algumas horas (dev)
- **HTTPS Obrigatório:** Webhooks precisam de HTTPS válido

## 🐛 Troubleshooting

### Webhook não está sendo verificado
- Verifique se o `verify_token` está correto
- Certifique-se de que o servidor está acessível publicamente
- Verifique os logs do servidor

### Mensagens não estão chegando
- Verifique se o webhook está configurado corretamente
- Confirme que os campos `messages` estão marcados
- Verifique os logs do servidor para erros

### Erro ao enviar mensagens
- Verifique se o token não expirou
- Confirme que o número está no formato correto (sem +, sem espaços)
- Verifique os logs para mensagens de erro da API

## 📚 Recursos Adicionais

- [Documentação Oficial do WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Guia de Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Templates de Mensagem](https://developers.facebook.com/docs/whatsapp/message-templates)



