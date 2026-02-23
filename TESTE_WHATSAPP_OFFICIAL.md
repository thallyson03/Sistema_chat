# 🧪 Guia de Teste - WhatsApp Official API

## ✅ Webhook Configurado!

Agora vamos testar se tudo está funcionando corretamente.

## 📋 Checklist de Teste

### 1. ✅ Verificar se o Servidor Está Rodando

Certifique-se de que o servidor está rodando e você vê nos logs:

```
[WhatsAppOfficial] ✅ Serviço inicializado
```

### 2. 📱 Enviar Mensagem de Teste

1. **Do seu WhatsApp pessoal** (+55 98 98566 3013)
2. **Para o número de teste** (+1 555 169 2364)
3. **Envie uma mensagem simples**, por exemplo: "Olá, teste"

### 3. 👀 Verificar Logs do Servidor

Quando você enviar a mensagem, você DEVE ver nos logs:

```
📨 ============================================
📨 Webhook recebido do WhatsApp Official API
📨 Timestamp: ...
[WhatsAppOfficial] 📩 Processando mensagem: ...
[WhatsAppOfficial] ✅ Mensagem salva: ...
```

### 4. 🤖 Testar Resposta do Bot (se configurado)

Se você tiver um bot configurado para o canal WhatsApp:
- O bot deve processar a mensagem automaticamente
- Você deve ver nos logs: `[BotService] Processando mensagem...`
- O bot deve responder automaticamente

### 5. 💬 Verificar no Sistema

1. Acesse o sistema: http://localhost:3000
2. Vá em **Conversas**
3. Você deve ver uma nova conversa com o contato
4. A mensagem enviada deve aparecer

### 6. 📤 Testar Envio de Mensagem

1. No sistema, abra a conversa
2. Digite uma mensagem e envie
3. Verifique nos logs:
   ```
   [WhatsAppOfficial] 📤 Enviando mensagem de texto: ...
   [WhatsAppOfficial] ✅ Mensagem enviada: ...
   ```
4. A mensagem deve chegar no seu WhatsApp pessoal

## 🔍 O Que Verificar

### ✅ Sucesso - Tudo Funcionando

- [ ] Mensagem recebida aparece nos logs
- [ ] Mensagem aparece no sistema (Conversas)
- [ ] Bot responde automaticamente (se configurado)
- [ ] Mensagem enviada do sistema chega no WhatsApp
- [ ] Status de mensagem é atualizado (delivered, read)

### ⚠️ Problemas Comuns

#### Mensagem não aparece nos logs
- Verifique se o ngrok está rodando
- Confirme que o webhook está ativado no Meta Developers
- Verifique se os campos `messages` estão marcados

#### Bot não responde
- Verifique se há um bot ativo para o canal WhatsApp
- Confirme que o bot tem um fluxo configurado
- Verifique os logs para erros do bot

#### Mensagem não chega no WhatsApp
- Verifique se o token não expirou (tokens temporários expiram em 60 minutos)
- Confirme que o número está no formato correto
- Verifique os logs para erros de envio

## 🎯 Próximos Passos Após Teste Bem-Sucedido

1. **Configurar Bot Completo**
   - Criar fluxos de conversação
   - Configurar intents e respostas
   - Testar diferentes cenários

2. **Preparar para Produção**
   - Obter token permanente
   - Configurar número real do WhatsApp Business
   - Criar e aprovar templates de mensagem

3. **Monitorar e Otimizar**
   - Acompanhar logs de erro
   - Verificar métricas de entrega
   - Ajustar fluxos conforme necessário

## 📊 Status de Mensagens

O sistema rastreia automaticamente:
- **PENDING** - Mensagem recebida, aguardando processamento
- **SENT** - Mensagem enviada com sucesso
- **DELIVERED** - Mensagem entregue ao destinatário
- **READ** - Mensagem lida pelo destinatário
- **FAILED** - Falha no envio

## 🆘 Precisa de Ajuda?

Se algo não estiver funcionando:
1. Verifique os logs do servidor
2. Confirme que todas as variáveis de ambiente estão corretas
3. Teste a URL do webhook manualmente
4. Verifique se o token não expirou

