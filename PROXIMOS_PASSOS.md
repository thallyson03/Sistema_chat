# 📋 Próximos Passos - Sistema de Atendimento

## ✅ Checklist de Configuração

### 1️⃣ Instalar Dependências (OBRIGATÓRIO)

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd client
npm install
cd ..
```

**Ou tudo de uma vez:**
```bash
npm install && npm install --prefix client
```

---

### 2️⃣ Criar Arquivo .env (OBRIGATÓRIO)

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

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

# Banco de Dados PostgreSQL
DATABASE_URL="postgresql://usuario:senha@localhost:5432/sistema_atendimento?schema=public"

# CORS
CORS_ORIGIN=http://localhost:3000
```

**⚠️ IMPORTANTE:**
- Altere `JWT_SECRET` para um valor seguro (use uma string aleatória longa)
- Configure o `DATABASE_URL` com suas credenciais do PostgreSQL
- Se você ainda não tem a Evolution API rodando, pode deixar os valores padrão por enquanto

---

### 3️⃣ Configurar Banco de Dados (OBRIGATÓRIO)

**3.1. Criar banco de dados no PostgreSQL:**

Abra o PostgreSQL e execute:
```sql
CREATE DATABASE sistema_atendimento;
```

**3.2. Gerar cliente Prisma:**
```bash
npx prisma generate
```

**3.3. Criar tabelas no banco:**
```bash
npx prisma migrate dev --name init
```

---

### 4️⃣ Criar Usuário Admin (OBRIGATÓRIO)

Execute o script de seed para criar o primeiro usuário:
```bash
npm run seed
```

Isso criará:
- **Email:** `admin@sistema.com`
- **Senha:** `admin123`
- **Role:** `ADMIN`

**⚠️ IMPORTANTE:** Altere a senha após o primeiro login!

---

### 5️⃣ Iniciar o Sistema (OPCIONAL - Para testar)

**Desenvolvimento (Backend + Frontend):**
```bash
npm run dev
```

Isso iniciará:
- Backend na porta **3001**
- Frontend na porta **3000**

**Ou separadamente:**

Terminal 1 (Backend):
```bash
npm run dev:server
```

Terminal 2 (Frontend):
```bash
npm run dev:client
```

---

## 🎯 Ordem Recomendada de Execução

1. ✅ Instalar dependências (Passo 1)
2. ✅ Configurar .env (Passo 2)
3. ✅ Configurar banco de dados (Passo 3)
4. ✅ Criar usuário admin (Passo 4)
5. ✅ Testar o sistema (Passo 5)

---

## 🔍 Verificações Finais

Após seguir todos os passos, verifique:

```bash
# Verificar se node_modules existe
Test-Path node_modules
Test-Path client/node_modules

# Verificar se .env existe
Test-Path .env

# Verificar se migrations foram criadas
Test-Path prisma/migrations
```

---

## 🆘 Precisa de Ajuda?

- **Dúvidas sobre PostgreSQL?** Certifique-se de que está instalado e rodando
- **Erro nas dependências?** Veja o arquivo `INSTALACAO_DEPENDENCIAS.md`
- **Problemas com Prisma?** Execute `npx prisma generate` novamente
- **Evolution API?** Você pode configurar depois, não é obrigatório para começar

---

## 📚 Documentação Adicional

- `README.md` - Documentação geral do projeto
- `SETUP.md` - Guia completo de configuração
- `API_EXAMPLES.md` - Exemplos de uso da API
- `INSTALACAO_DEPENDENCIAS.md` - Troubleshooting de instalação





