# 📡 Configuração de Webhook com ngrok

Este guia explica como configurar o webhook para receber mensagens da Evolution API em ambiente de desenvolvimento usando ngrok.

## 🎯 Por que usar ngrok?

- **Evolution API está em produção** (servidor remoto)
- **Seu sistema está em desenvolvimento** (localhost)
- **ngrok cria um túnel** para expor seu localhost na internet
- **Evolution API precisa de uma URL pública** para enviar webhooks

## 📋 Pré-requisitos

1. **ngrok instalado** - [Download aqui](https://ngrok.com/download)
2. **Servidor rodando** na porta 3007 (ou a porta configurada)
3. **Variável NGROK_URL** no arquivo `.env`

## 🚀 Passo a Passo

### 1. Iniciar o ngrok

Abra um terminal e execute:

```bash
ngrok http 3007
```

Você verá algo como:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3007
```

**Copie a URL HTTPS** (ex: `https://abc123.ngrok-free.app`)

### 2. Configurar no .env

Adicione ou atualize no arquivo `.env`:

```env
# Webhook URL (ngrok para desenvolvimento)
NGROK_URL=https://abc123.ngrok-free.app

# Ou use APP_URL se não tiver ngrok
# APP_URL=http://localhost:3007
```

⚠️ **IMPORTANTE**: Use `NGROK_URL` para desenvolvimento (prioridade) ou `APP_URL` para produção.

### 3. Reiniciar o servidor

Após configurar o `.env`, reinicie o servidor:

```bash
npm run dev
```

### 4. Configurar Webhook no Canal

O webhook é configurado **automaticamente** quando:

- ✅ Canal é criado
- ✅ Canal conecta ao WhatsApp
- ✅ Status do canal muda para ACTIVE

**OU configure manualmente via API:**

```bash
POST http://localhost:3007/api/channels/{channelId}/webhook
Authorization: Bearer SEU_TOKEN
```

## 🔍 Verificar se Webhook está Configurado

### Via Logs do Servidor

Quando o webhook é configurado, você verá logs como:

```
[ChannelService] ============================================
[ChannelService] 📡 CONFIGURANDO WEBHOOK
[ChannelService] Instância: channel_1234567890
[ChannelService] URL do Webhook: https://abc123.ngrok-free.app/webhooks/evolution
[ChannelService] Usando ngrok: true
[ChannelService] ============================================
[EvolutionAPI] ✅ Webhook configurado com sucesso
[ChannelService] ✅ WEBHOOK CONFIGURADO COM SUCESSO!
```

### Via Painel da Evolution API

1. Acesse o painel da Evolution API
2. Vá na instância criada
3. Verifique a seção "Webhooks"
4. Deve aparecer: `https://abc123.ngrok-free.app/webhooks/evolution`

## 🧪 Testar Recebimento de Mensagens

1. **Envie uma mensagem** para o número conectado no WhatsApp
2. **Verifique os logs** do servidor - deve aparecer:

```
📨 ============================================
📨 Webhook recebido da Evolution API
📨 Event: messages.upsert
📨 ============================================
```

3. **Verifique no frontend** - a mensagem deve aparecer na conversa

## ⚠️ Problemas Comuns

### Webhook não está sendo configurado

**Causa**: `NGROK_URL` não configurado no `.env`

**Solução**: 
1. Adicione `NGROK_URL=https://seu-ngrok.ngrok-free.app` no `.env`
2. Reinicie o servidor

### ngrok URL mudou

**Causa**: ngrok gera nova URL a cada reinício (versão gratuita)

**Solução**:
1. Copie a nova URL do ngrok
2. Atualize `NGROK_URL` no `.env`
3. Reinicie o servidor
4. Configure o webhook manualmente via API

### Webhook recebido mas mensagem não aparece

**Causa**: Erro ao processar webhook

**Solução**:
1. Verifique os logs do servidor
2. Verifique se o canal está correto
3. Verifique se o contato está sendo criado

## 🔄 Configurar Webhook Manualmente

Se o webhook não foi configurado automaticamente, você pode configurar manualmente:

### Via API

```bash
curl -X POST http://localhost:3007/api/channels/{channelId}/webhook \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"
```

### Resposta de Sucesso

```json
{
  "success": true,
  "message": "Webhook configurado com sucesso",
  "webhookUrl": "https://abc123.ngrok-free.app/webhooks/evolution"
}
```

### Resposta de Erro

```json
{
  "success": false,
  "message": "NGROK_URL ou APP_URL não configurado no .env",
  "webhookUrl": null
}
```

## 📝 Checklist

- [ ] ngrok instalado e rodando
- [ ] `NGROK_URL` configurado no `.env`
- [ ] Servidor reiniciado após configurar `.env`
- [ ] Canal criado e conectado
- [ ] Webhook configurado (verificar logs)
- [ ] Teste enviando mensagem para o número conectado
- [ ] Mensagem aparece no sistema

## 🎯 URLs Importantes

- **Webhook Endpoint**: `https://seu-ngrok.ngrok-free.app/webhooks/evolution`
- **Rota Alternativa**: `https://seu-ngrok.ngrok-free.app/api/whatsapp/webhook`
- **Health Check**: `https://seu-ngrok.ngrok-free.app/health`

## 💡 Dicas

1. **ngrok gratuito**: URL muda a cada reinício - use ngrok pago para URL fixa
2. **Logs detalhados**: Sempre verifique os logs quando configurar webhook
3. **Teste primeiro**: Envie uma mensagem de teste após configurar
4. **Verifique no painel**: Confirme no painel da Evolution API que o webhook está configurado

## 🚨 Em Produção

Quando for para produção:

1. **Remova `NGROK_URL`** do `.env`
2. **Configure `APP_URL`** com sua URL de produção:
   ```env
   APP_URL=https://seu-dominio.com
   ```
3. **Reinicie o servidor**
4. **Configure webhook** manualmente se necessário

---

✅ **Pronto!** Seu webhook está configurado e pronto para receber mensagens!



