# 🚀 Como Iniciar o Sistema

## Erro: `ERR_CONNECTION_REFUSED`

O erro indica que o servidor backend não está rodando. Siga os passos abaixo para iniciar:

## Opção 1: Iniciar Servidor e Frontend Juntos (Recomendado)

Em um único terminal, na raiz do projeto:

```bash
npm run dev
```

Isso iniciará:
- ✅ Backend na porta 3007
- ✅ Frontend na porta 3000

## Opção 2: Iniciar Separadamente

### Terminal 1 - Backend:
```bash
npm run dev:server
```

Você deve ver:
```
🚀 Servidor rodando na porta 3007
📡 Webhooks disponíveis em http://localhost:3007/webhooks
🔗 Evolution API: https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/
```

### Terminal 2 - Frontend:
```bash
npm run dev:client
```

Você deve ver:
```
➜  Local:   http://localhost:3000/
```

## ✅ Verificar se Está Funcionando

1. **Backend:** Acesse `http://localhost:3007/health` no navegador
   - Deve retornar: `{"status":"ok","timestamp":"..."}`

2. **Frontend:** Acesse `http://localhost:3000`
   - Deve carregar a página de login

## ⚠️ Problemas Comuns

### Porta 3007 já está em uso:
```bash
# No PowerShell:
$conn = Get-NetTCPConnection -LocalPort 3007 -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
```

Depois, tente iniciar novamente.

### Servidor não inicia:
1. Verifique se o `.env` está configurado corretamente
2. Verifique se as dependências estão instaladas: `npm install`
3. Verifique os logs do terminal para erros específicos





