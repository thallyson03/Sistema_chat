# 🚀 Como Iniciar o Servidor Corretamente

## Problema: Porta 3007 já em uso

Se você ver o erro `EADDRINUSE: address already in use :::3007`, significa que há outro processo usando a porta.

## ✅ Solução Rápida:

### Opção 1: Reiniciar com Nodemon (Mais Fácil)

No terminal onde você rodou `npm run dev`, simplesmente digite:
```
rs
```
E pressione Enter. Isso reinicia o servidor automaticamente.

### Opção 2: Parar e Iniciar Novamente

1. No terminal, pressione **Ctrl+C** para parar tudo
2. Execute novamente:
   ```bash
   npm run dev
   ```

### Opção 3: Liberar a Porta Manualmente

Se ainda der erro, execute no PowerShell:

```powershell
# Encontrar e matar o processo na porta 3007
Get-Process -Id (Get-NetTCPConnection -LocalPort 3007).OwningProcess | Stop-Process -Force

# Depois inicie o servidor
npm run dev
```

## 🔍 Verificar se o Servidor Está Rodando:

Após iniciar, você deve ver no terminal:
```
🚀 Servidor rodando na porta 3007
📡 Webhooks disponíveis em http://localhost:3007/webhooks
🔗 Evolution API: https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io
```

## ⚠️ IMPORTANTE:

**Mantenha o terminal visível!** Os logs aparecerão lá quando você tentar criar um canal.

## 📝 Após o Servidor Iniciar:

1. **Mantenha o terminal visível**
2. **Tente criar o canal novamente**
3. **Observe os logs** que aparecerão no terminal
4. **Me envie os logs** que aparecerem quando tentar criar o canal






