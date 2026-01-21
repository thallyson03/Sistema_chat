# 📖 Guia de Uso - Sistema de Atendimento

## 🎯 Próximos Passos Após Login

### 1️⃣ Explorar o Dashboard

O Dashboard mostra:
- **Total** de conversas
- **Abertas** - Conversas em andamento
- **Aguardando** - Conversas aguardando resposta
- **Fechadas** - Conversas finalizadas

### 2️⃣ Configurar um Canal WhatsApp

Para começar a receber mensagens, você precisa configurar um canal:

#### Passo 1: Ter a Evolution API Rodando

A Evolution API deve estar instalada e rodando. Se não tiver:

**Opção Docker (Recomendado):**
```bash
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua_api_key_aqui \
  atendai/evolution-api:latest
```

**Opção Manual:**
Siga a documentação: https://doc.evolution-api.com/

#### Passo 2: Criar Canal no Sistema

1. Vá em **"Canais"** no menu lateral
2. Clique em **"Criar Novo Canal"** (ou use a API)
3. Preencha:
   - **Nome:** "WhatsApp Principal"
   - **Tipo:** WHATSAPP
   - **Evolution API Key:** Sua chave da Evolution API

#### Passo 3: Conectar WhatsApp

1. Após criar o canal, clique nele
2. Acesse **"Ver QR Code"** ou use a API: `GET /api/channels/:id/qrcode`
3. Escaneie o QR Code com o WhatsApp que deseja conectar
4. Aguarde o status mudar para **"ACTIVE"**

### 3️⃣ Criar Usuários Adicionais

Para criar mais usuários, use a API:

```bash
curl -X POST http://localhost:3007/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agente@exemplo.com",
    "password": "senha123",
    "name": "João Silva",
    "role": "AGENT"
  }'
```

**Roles disponíveis:**
- `ADMIN` - Acesso total
- `SUPERVISOR` - Pode gerenciar canais e visualizar tudo
- `AGENT` - Pode atender conversas atribuídas

### 4️⃣ Atender Conversas

#### Receber Mensagens
Quando uma mensagem chegar via WhatsApp (ou outro canal):
- A conversa aparecerá automaticamente na lista
- O contador de "não lidas" será incrementado
- A conversa ficará com status "OPEN"

#### Responder Mensagens
1. Clique na conversa para abrir
2. Visualize as mensagens recebidas
3. Digite sua resposta
4. Envie a mensagem

#### Atribuir Conversas
- Você pode atribuir conversas a outros agentes
- Use: `PUT /api/conversations/:id` com `assignedToId`

### 5️⃣ Organizar Conversas

#### Tags
- Use tags para categorizar conversas
- Tags já criadas: Urgente, Venda, Suporte, Financeiro

#### Status
- **OPEN** - Em andamento
- **WAITING** - Aguardando resposta
- **CLOSED** - Fechada
- **ARCHIVED** - Arquivada

#### Prioridades
- **LOW** - Baixa
- **MEDIUM** - Média
- **HIGH** - Alta
- **URGENT** - Urgente

### 6️⃣ Gerenciar Canais

#### Ver Status dos Canais
```bash
GET /api/channels/:id/status
```

#### Verificar QR Code
```bash
GET /api/channels/:id/qrcode
```

#### Atualizar Canal
```bash
PUT /api/channels/:id
{
  "name": "Novo Nome",
  "status": "ACTIVE"
}
```

## 🔧 Funcionalidades Disponíveis

### API Endpoints Principais

#### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Criar usuário
- `GET /api/auth/me` - Usuário atual

#### Conversas
- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id` - Detalhes da conversa
- `PUT /api/conversations/:id` - Atualizar conversa
- `POST /api/conversations/:id/assign` - Atribuir conversa
- `GET /api/conversations/stats` - Estatísticas

#### Mensagens
- `POST /api/messages` - Enviar mensagem
- `GET /api/messages/conversation/:conversationId` - Listar mensagens
- `PUT /api/messages/conversation/:conversationId/read` - Marcar como lida

#### Canais
- `GET /api/channels` - Listar canais
- `POST /api/channels` - Criar canal
- `GET /api/channels/:id/qrcode` - QR Code
- `GET /api/channels/:id/status` - Status do canal

## 🎨 Melhorias Futuras (Para Implementar)

- [ ] Interface de chat em tempo real
- [ ] Upload de arquivos/mídia
- [ ] Notificações push
- [ ] Histórico de conversas mais detalhado
- [ ] Relatórios e analytics
- [ ] Integração com Telegram
- [ ] Integração com Email
- [ ] Webchat embutido

## 📚 Recursos Adicionais

- **Documentação da Evolution API:** https://doc.evolution-api.com/
- **Exemplos de API:** Veja `API_EXAMPLES.md`
- **Guia de Setup:** Veja `SETUP.md`

## 🆘 Precisa de Ajuda?

Se encontrar problemas:
1. Verifique se o servidor está rodando
2. Verifique se o PostgreSQL está conectado
3. Verifique os logs do servidor no terminal
4. Consulte os arquivos de documentação







