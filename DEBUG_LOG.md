# 🔍 Como Ver os Logs do Servidor

## Passo a Passo:

### 1. Encontre o Terminal do Servidor

O servidor deve estar rodando em um terminal. Procure por:
- Um terminal PowerShell/CMD que você deixou aberto
- Ou inicie um novo terminal e rode: `npm run dev:server`

### 2. Mantenha o Terminal Visível

Ao tentar criar um canal, você deve ver logs como:

```
[ChannelController] Recebendo requisição para criar canal
[ChannelController] Body: { ... }
[ChannelService] createChannel chamado
[ChannelService] Dados recebidos: { ... }
[Evolution API] Criando instância: { ... }
```

### 3. Se Nenhum Log Aparecer

Isso significa que:
- O servidor não está rodando
- Ou a requisição não está chegando ao servidor
- Ou há um erro antes de chegar no controller

## Solução Rápida:

1. **Pare o servidor** (Ctrl+C no terminal)
2. **Inicie novamente** em um terminal visível:
   ```bash
   npm run dev:server
   ```
3. **Mantenha o terminal aberto e visível**
4. **Tente criar o canal novamente**
5. **Observe os logs que aparecem**

## O que Procurar nos Logs:

- `[ChannelController] Recebendo requisição` - A requisição chegou
- `[ChannelService] createChannel chamado` - O service foi chamado
- `[Evolution API] Criando instância` - Tentando criar na Evolution API
- `[Evolution API] Erro completo:` - Se houver erro, aparecerá aqui

Se nada aparecer, a requisição não está chegando ao servidor!






