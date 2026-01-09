# Passo a Passo para Instalar as Dependências

## 📋 Pré-requisitos

Certifique-se de ter instalado:
- **Node.js** (versão 18 ou superior)
- **npm** (vem junto com o Node.js)

Para verificar se estão instalados, execute no terminal:
```bash
node --version
npm --version
```

## 🚀 Instalação

### Passo 1: Instalar Dependências do Backend

Abra o terminal na pasta raiz do projeto e execute:

```bash
npm install
```

Este comando irá:
- Ler o arquivo `package.json`
- Baixar e instalar todas as dependências listadas
- Criar a pasta `node_modules` com todos os pacotes
- Gerar o arquivo `package-lock.json` (se ainda não existir)

**Tempo estimado:** 2-5 minutos (dependendo da velocidade da internet)

### Passo 2: Instalar Dependências do Frontend

Ainda no terminal, navegue até a pasta `client` e execute:

```bash
cd client
npm install
```

Ou execute diretamente da pasta raiz:

```bash
npm install --prefix client
```

Este comando irá:
- Ler o arquivo `client/package.json`
- Baixar e instalar todas as dependências do React/Vite
- Criar a pasta `client/node_modules`

**Tempo estimado:** 2-5 minutos

### Passo 3: Verificar Instalação

Após a instalação, verifique se tudo foi instalado corretamente:

```bash
# Voltar para a raiz (se estiver na pasta client)
cd ..

# Verificar se node_modules existe
Test-Path node_modules
# Deve retornar: True

# Verificar se client/node_modules existe
Test-Path client/node_modules
# Deve retornar: True
```

## ⚠️ Problemas Comuns

### Erro: "npm não é reconhecido"

**Solução:** Instale o Node.js de https://nodejs.org/

### Erro: "permission denied" ou "EACCES"

**Solução (Windows):** Execute o terminal como Administrador ou use:
```bash
npm install --no-optional
```

### Erro: "ERESOLVE unable to resolve dependency"

**Solução:** Limpe o cache e reinstale:
```bash
npm cache clean --force
npm install
```

### Erro: Falha de conexão ou timeout

**Solução:** Verifique sua conexão com a internet ou use um registry diferente:
```bash
npm install --registry https://registry.npmjs.org/
```

## ✅ Próximos Passos Após Instalação

1. **Configurar variáveis de ambiente:**
   - Copie o arquivo `.env.example` para `.env` (se existir)
   - Ou crie um arquivo `.env` com as configurações necessárias

2. **Configurar o banco de dados:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

3. **Iniciar o servidor:**
   ```bash
   npm run dev
   ```

## 📝 Comandos Úteis

```bash
# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd client && npm install && cd ..

# Instalar ambas de uma vez (se tiver o script configurado)
npm install && npm install --prefix client

# Verificar versões
node --version
npm --version

# Listar dependências instaladas
npm list --depth=0
```



