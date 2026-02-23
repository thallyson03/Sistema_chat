# 📋 Como Configurar os Campos do Webhook

## ⚠️ Problema Identificado

Na sua configuração, os campos `messages` e `message_status` provavelmente não estão assinados (subscribed).

## ✅ Solução

### 1. Role a tabela de campos do webhook para baixo

Na página do Meta Developers, role até encontrar os campos:
- `messages` - Para receber mensagens recebidas
- `message_status` - Para receber atualizações de status (entregue, lida, etc.)

### 2. Ative os campos necessários

Para cada campo (`messages` e `message_status`):
1. Encontre a coluna "Assinar" (Subscribe)
2. Ative o toggle switch (deve ficar azul/verde)
3. O status deve mudar de "Cancelou a assinatura" para "Assinado"

### 3. Clique em "Verificar e salvar"

Após ativar os campos, clique no botão azul "Verificar e salvar" no topo da seção.

### 4. Verifique se o webhook está ativo

Após salvar, você deve ver:
- ✅ Um ícone verde indicando que o webhook está verificado
- ✅ Os campos `messages` e `message_status` marcados como "Assinado"

## 📝 Campos Recomendados para Assinar

Para um sistema de atendimento completo, assine:

1. **`messages`** ✅ OBRIGATÓRIO
   - Recebe mensagens de texto, mídia, etc.
   - Versão: v25.0 (ou a mais recente)

2. **`message_status`** ✅ OBRIGATÓRIO
   - Recebe atualizações de status (enviado, entregue, lido)
   - Versão: v25.0 (ou a mais recente)

3. **`account_alerts`** (Opcional)
   - Alertas sobre a conta
   - Útil para monitoramento

## ⚠️ Importante: App não publicado

Se o app não estiver publicado, você só receberá:
- ✅ Webhooks de teste enviados pelo painel do Meta
- ❌ NÃO receberá mensagens reais de usuários

Para receber mensagens reais:
1. Publique o app no Meta
2. Ou use o número de teste do Meta para enviar mensagens de teste

## 🧪 Como Testar

### Opção 1: Enviar mensagem de teste pelo painel
1. No Meta Developers, vá em "Testes de API"
2. Use a ferramenta de envio de mensagem de teste
3. Verifique os logs do servidor

### Opção 2: Usar número de teste
1. Configure um número de teste do WhatsApp Business
2. Envie mensagens para esse número
3. Verifique os logs do servidor

## 🔍 Verificar se está funcionando

Após configurar, quando uma mensagem chegar, você deve ver nos logs:

```
📨 ============================================
📨 Webhook recebido do WhatsApp Official API
📨 Timestamp: ...
[WhatsAppOfficial] 📩 Processando 1 mensagem(ns)
```

Se não aparecer, verifique:
- [ ] Campos `messages` e `message_status` estão assinados?
- [ ] Webhook está verificado (ícone verde)?
- [ ] ngrok está rodando?
- [ ] URL está correta no Meta?

