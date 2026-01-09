# Sistema de Atendimento ao Cliente - Multicanal e Multiusuário

Sistema completo de atendimento ao cliente com suporte a múltiplos canais (WhatsApp, Telegram, Email, Webchat) e múltiplos usuários. Utiliza a Evolution API para integração com WhatsApp.

## 🚀 Funcionalidades

- **Multicanal**: Suporte para WhatsApp (via Evolution API), Telegram, Email e Webchat
- **Multiusuário**: Sistema de autenticação com diferentes níveis de permissão (Admin, Supervisor, Agente)
- **Gestão de Conversas**: Controle completo de conversas, mensagens e atendimentos
- **Tempo Real**: Notificações em tempo real via WebSocket (Socket.IO)
- **Dashboard**: Painel de controle com estatísticas e métricas
- **Tags e Prioridades**: Organização de conversas com tags e níveis de prioridade

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL
- Evolution API (para WhatsApp) - [Documentação](https://doc.evolution-api.com/)

## 🛠️ Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd "Sitema de chat"
```

### 2. Instale as dependências do backend

```bash
npm install
```

### 3. Instale as dependências do frontend

```bash
cd client
npm install
cd ..
```

### 4. Configure o banco de dados

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```env
# Servidor
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=7d

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_evolution_api_key_aqui

# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/sistema_atendimento?schema=public"

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 5. Configure o Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 6. Inicie o servidor

Para desenvolvimento (backend e frontend simultaneamente):

```bash
npm run dev
```

Ou separadamente:

```bash
# Backend
npm run dev:server

# Frontend (em outro terminal)
npm run dev:client
```

## 📚 Estrutura do Projeto

```
.
├── src/
│   ├── config/          # Configurações (banco, Evolution API)
│   ├── controllers/     # Controladores das rotas
│   ├── middleware/      # Middlewares (autenticação)
│   ├── routes/          # Definição de rotas
│   ├── services/        # Lógica de negócio
│   └── server.ts        # Servidor Express
├── prisma/
│   └── schema.prisma    # Schema do banco de dados
├── client/              # Frontend React
└── package.json
```

## 🔌 API Endpoints

### Autenticação

- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Obter usuário atual

### Canais

- `GET /api/channels` - Listar canais
- `POST /api/channels` - Criar canal (Admin/Supervisor)
- `GET /api/channels/:id` - Obter canal
- `PUT /api/channels/:id` - Atualizar canal
- `DELETE /api/channels/:id` - Deletar canal
- `GET /api/channels/:id/qrcode` - Obter QR Code (WhatsApp)
- `GET /api/channels/:id/status` - Verificar status do canal

### Conversas

- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id` - Obter conversa
- `PUT /api/conversations/:id` - Atualizar conversa
- `POST /api/conversations/:id/assign` - Atribuir conversa
- `GET /api/conversations/stats` - Estatísticas
- `GET /api/conversations/unread-count` - Contador de não lidas

### Mensagens

- `POST /api/messages` - Enviar mensagem
- `GET /api/messages/conversation/:conversationId` - Listar mensagens
- `PUT /api/messages/conversation/:conversationId/read` - Marcar como lida

### Webhooks

- `POST /webhooks/evolution` - Webhook da Evolution API

## 🔐 Permissões de Usuário

- **ADMIN**: Acesso total ao sistema
- **SUPERVISOR**: Pode gerenciar canais e visualizar todas as conversas
- **AGENT**: Pode atender conversas atribuídas

## 📱 Configuração da Evolution API

1. Certifique-se de que a Evolution API está rodando
2. Configure a URL e a API Key no arquivo `.env`
3. Ao criar um canal WhatsApp, o sistema automaticamente:
   - Cria uma instância na Evolution API
   - Gera o QR Code para conexão
   - Configura o webhook para receber mensagens

## 🧪 Criando o Primeiro Usuário

Você pode criar o primeiro usuário através da API:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@exemplo.com",
    "password": "senha123",
    "name": "Administrador",
    "role": "ADMIN"
  }'
```

## 📝 Próximos Passos

- [ ] Implementar interface completa de chat
- [ ] Adicionar suporte a Telegram e Email
- [ ] Implementar sistema de tags
- [ ] Adicionar relatórios e analytics
- [ ] Implementar upload de arquivos
- [ ] Adicionar notificações push

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## 📄 Licença

MIT



