# 🔧 Troubleshooting - Erro ao Salvar Webhook (#1004)

## Possíveis Causas e Soluções

### 1. ✅ Verificar se o Servidor Está Rodando

**Antes de salvar o webhook, o servidor DEVE estar rodando!**

```bash
npm run dev
```

Você deve ver:
```
[WhatsAppOfficial] ✅ Serviço inicializado
```

### 2. ✅ Verificar se o ngrok Está Ativo

O ngrok precisa estar rodando e acessível:

```bash
# Verifique se o ngrok está rodando
# A URL deve estar ativa: https://bronchially-unlimed-kemberly.ngrok-free.dev
```

**⚠️ IMPORTANTE:** Se você fechou o terminal do ngrok, ele para de funcionar. Reinicie:

```bash
ngrok http 3007
```

### 3. ✅ Testar a Rota Manualmente

Abra no navegador ou use um cliente HTTP:

```
https://bronchially-unlimed-kemberly.ngrok-free.dev/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=crm_chat_webhook_dev&hub.challenge=test123
```

**Resposta esperada:** Deve retornar `test123` (o challenge)

Se retornar `Forbidden` ou erro, verifique:
- Servidor está rodando
- `.env` tem o token correto
- Rota está registrada no servidor

### 4. ✅ Verificar Variáveis de Ambiente

Confirme que o `.env` tem:

```env
WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN="crm_chat_webhook_dev"
WHATSAPP_ENV="dev"
NGROK_URL="https://bronchially-unlimed-kemberly.ngrok-free.dev"
```

**Após alterar o `.env`, REINICIE o servidor!**

### 5. ✅ Verificar Logs do Servidor

Quando você clica em "Verificar e salvar" no Meta, você DEVE ver nos logs:

```
[WebhookWhatsApp] 🔐 Verificação do webhook: ...
```

Se não aparecer nada, o Meta não está conseguindo acessar sua URL.

### 6. ⚠️ Problema com ngrok-free.dev

O ngrok gratuito pode ter limitações. Tente:

**Opção A: Usar ngrok autenticado (recomendado)**
```bash
# Criar conta gratuita no ngrok.com
# Fazer login
ngrok config add-authtoken SEU_TOKEN
ngrok http 3007
```

**Opção B: Usar outro túnel (alternativa)**
- Cloudflare Tunnel
- LocalTunnel
- Serveo

### 7. ✅ Verificar Formato da URL

A URL deve ser **exatamente**:

```
https://bronchially-unlimed-kemberly.ngrok-free.dev/api/webhooks/whatsapp
```

**Sem barra no final!** ❌ `/api/webhooks/whatsapp/` (errado)

### 8. ✅ Verificar se a Rota Está Registrada

Confirme que no `src/server.ts` tem:

```typescript
app.use('/api/webhooks', webhookRoutes);
```

### 9. 🔄 Tentar Novamente

Depois de verificar tudo acima:

1. **Pare o servidor** (Ctrl+C)
2. **Reinicie o ngrok** (se necessário)
3. **Reinicie o servidor** (`npm run dev`)
4. **Aguarde 10 segundos** para o servidor inicializar
5. **Tente salvar o webhook novamente** no Meta Developers

### 10. 📋 Checklist Final

- [ ] Servidor rodando (`npm run dev`)
- [ ] ngrok rodando e URL ativa
- [ ] `.env` configurado corretamente
- [ ] Servidor reiniciado após alterar `.env`
- [ ] URL do webhook sem barra no final
- [ ] Token de verificação igual no `.env` e no Meta
- [ ] Teste manual da URL retorna o challenge
- [ ] Logs do servidor mostram tentativa de verificação

## 🆘 Se Ainda Não Funcionar

1. **Verifique os logs do servidor** quando clicar em "Verificar e salvar"
2. **Teste a URL manualmente** no navegador
3. **Tente com um token mais simples** (sem caracteres especiais)
4. **Use ngrok autenticado** (mais confiável)
5. **Verifique se há firewall bloqueando** a porta 3007

## 📞 Informações para Debug

Se precisar de ajuda, forneça:
- Logs do servidor quando tenta salvar
- Resposta do teste manual da URL
- Se o ngrok está autenticado ou não
- Mensagem de erro completa do Meta

