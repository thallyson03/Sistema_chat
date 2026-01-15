# 🔍 Como Ver os Logs do Servidor

## ⚠️ IMPORTANTE: Os logs são essenciais!

Para identificar o problema, você **DEVE** ver os logs do servidor no terminal.

## 📋 Passos:

### 1. Encontre o Terminal do Servidor

Procure um terminal/PowerShell onde você executou:
```bash
npm run dev:server
```

Ou procure um terminal com o título mostrando "node" ou "ts-node".

### 2. Se o Terminal Não Estiver Visível

Abra um **novo terminal** e:

1. Navegue até a pasta do projeto:
   ```bash
   cd "C:\Users\PICHAU\Documents\Sitema de chat"
   ```

2. Pare qualquer processo na porta 3007 (se necessário):
   ```bash
   # No PowerShell:
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3007).OwningProcess | Stop-Process -Force
   ```

3. Inicie o servidor novamente:
   ```bash
   npm run dev:server
   ```

### 3. Mantenha o Terminal Visível

**NÃO** minimize ou feche o terminal. Mantenha-o visível na tela.

### 4. Tente Criar o Canal Novamente

Quando você tentar criar o canal, você **DEVE** ver logs como:

```
[Auth] authenticateToken chamado
[Auth] Token presente: eyJ...
[ChannelController] Recebendo requisição para criar canal
[ChannelService] createChannel chamado
[Evolution API] Criando instância: ...
[Evolution API] URL completa: https://...
[Evolution API] API Key (primeiros 15 chars): 78F68D01CE85-4
[Evolution API] Request data: {...}
[Evolution API] ❌ Erro completo: {...}
```

## 🎯 O Que Procurar nos Logs:

Quando você tentar criar o canal, os logs devem mostrar:
- ✅ Se a requisição chegou ao servidor
- ✅ Qual API Key está sendo usada
- ✅ Qual URL está sendo chamada
- ✅ O body completo da requisição
- ✅ A resposta completa da Evolution API (incluindo o erro)

## ❌ Se Nenhum Log Aparecer:

Isso significa que:
- O servidor não está rodando
- Ou a requisição não está chegando ao servidor
- Ou há um erro antes de chegar aos logs

Nesse caso, verifique:
1. O servidor está realmente rodando? (porta 3007)
2. Há algum erro ao iniciar o servidor?
3. O frontend está chamando a URL correta?

## 📸 Capture os Logs

Quando tentar criar o canal, **copie TODOS os logs** que aparecerem e me envie!





