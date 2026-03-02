# Instalação das Dependências do Magic UI

## ⚠️ IMPORTANTE: Execute estes comandos antes de rodar o sistema

O sistema foi atualizado para usar Magic UI, mas as dependências precisam ser instaladas.

### Passo 1: Instalar dependências

No diretório `client`, execute:

```bash
cd client
npm install
```

Isso instalará:
- ✅ `framer-motion` (já adicionado ao package.json)
- ✅ `tailwindcss` (já adicionado ao package.json)
- ✅ `postcss` (já adicionado ao package.json)
- ✅ `autoprefixer` (já adicionado ao package.json)

### Passo 2: Verificar se os arquivos de configuração existem

Os seguintes arquivos devem existir:
- ✅ `client/tailwind.config.js`
- ✅ `client/postcss.config.js`
- ✅ `client/src/index.css` (atualizado com @tailwind)

### Passo 3: Rodar o sistema

Após instalar as dependências, execute:

```bash
# Na raiz do projeto
npm run dev
```

Ou separadamente:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

## 🔧 Se ainda não funcionar

1. **Limpar cache do npm:**
   ```bash
   cd client
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verificar erros no console:**
   - Abra o DevTools (F12)
   - Verifique a aba Console
   - Verifique a aba Network

3. **Verificar se o Vite está rodando:**
   - O Vite deve iniciar na porta 3000
   - Verifique se não há conflito de porta

## 📝 Nota

Se você ainda não instalou as dependências, o sistema não vai rodar porque:
- `framer-motion` é necessário para as animações
- `tailwindcss` é necessário para os estilos
- Os componentes Magic UI dependem dessas bibliotecas





