# Guia de Configuração - Sistema de Atendimento

## Passo a Passo para Iniciar

### 1. Instalar Dependências

```bash
# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd client
npm install
cd ..
```

### 2. Configurar Banco de Dados PostgreSQL

Certifique-se de que o PostgreSQL está instalado e rodando. Crie um banco de dados:

```sql
CREATE DATABASE sistema_atendimento;
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:3001

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRES_IN=7d

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_evolution_api_key_aqui

# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/sistema_atendimento?schema=public"

# CORS
CORS_ORIGIN=http://localhost:3000
```

**⚠️ IMPORTANTE**: Altere o `JWT_SECRET` para um valor seguro em produção!

### 4. Configurar Prisma

```bash
# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev --name init
```

### 5. Criar Usuário Admin Inicial

Execute o script de seed para criar o primeiro usuário admin:

```bash
npm run seed
```

Isso criará:
- Usuário: `admin@sistema.com`
- Senha: `admin123`
- Role: `ADMIN`

**⚠️ IMPORTANTE**: Altere a senha após o primeiro login!

### 6. Configurar Evolution API

#### Opção 1: Docker (Recomendado)

```bash
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua_evolution_api_key_aqui \
  atendai/evolution-api:latest
```

#### Opção 2: Instalação Manual

Siga a documentação oficial: https://doc.evolution-api.com/

### 7. Iniciar o Sistema

#### Desenvolvimento (Backend + Frontend)

```bash
npm run dev
```

Isso iniciará:
- Backend na porta 3001
- Frontend na porta 3000

#### Ou separadamente:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

### 8. Acessar o Sistema

1. Abra o navegador em: http://localhost:3000
2. Faça login com:
   - Email: `admin@sistema.com`
   - Senha: `admin123`

## Configurando um Canal WhatsApp

1. Faça login no sistema
2. Vá em "Canais"
3. Clique em "Criar Novo Canal"
4. Preencha:
   - Nome: "WhatsApp Principal"
   - Tipo: "WHATSAPP"
   - Evolution API Key: (sua chave da Evolution API)
5. Após criar, clique no canal e acesse "Ver QR Code"
6. Escaneie o QR Code com o WhatsApp que deseja conectar
7. Aguarde a conexão (status mudará para "ACTIVE")

## Estrutura do Banco de Dados

O sistema utiliza Prisma como ORM. Para visualizar o banco:

```bash
npx prisma studio
```

Isso abrirá uma interface visual em http://localhost:5555

## Troubleshooting

### Erro: "Cannot find module '@prisma/client'"

Execute:
```bash
npx prisma generate
```

### Erro de conexão com banco de dados

Verifique:
1. PostgreSQL está rodando
2. Credenciais no `.env` estão corretas
3. Banco de dados foi criado

### Erro ao conectar Evolution API

Verifique:
1. Evolution API está rodando
2. URL e API Key estão corretas no `.env`
3. Porta 8080 está acessível

### Mensagens não estão chegando

Verifique:
1. Webhook está configurado corretamente na Evolution API
2. URL do webhook está acessível: `http://seu-servidor:3001/webhooks/evolution`
3. Canal está com status "ACTIVE"

## Próximos Passos

Após a configuração inicial:

1. ✅ Criar mais usuários (Agentes, Supervisores)
2. ✅ Configurar canais adicionais
3. ✅ Personalizar tags e categorias
4. ✅ Configurar notificações
5. ✅ Ajustar permissões por role

## Suporte

Para mais informações, consulte:
- [Documentação da Evolution API](https://doc.evolution-api.com/)
- [Documentação do Prisma](https://www.prisma.io/docs)
- README.md principal



