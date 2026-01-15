# 🔍 Verificando Problema de IP/Origem na Evolution API

## Problema Possível

A Evolution API pode estar bloqueando requisições vindas de `localhost` porque:
1. **IP Whitelist** - A Evolution API pode ter uma lista de IPs permitidos configurada
2. **Validação de Origem** - Pode verificar se a requisição vem de um IP confiável
3. **CORS/Origem** - Embora seja server-side, pode haver validação de origem

## Como Verificar

### 1. Teste Direto com o Script

Execute o script de teste que tenta criar uma instância diretamente:

```bash
node scripts/testCreateInstanceDirect.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io 78F68D01CE85-487F-ABE6-9685B4437541
```

Se funcionar, o problema é no código do sistema.
Se não funcionar, pode ser:
- API Key incorreta
- IP bloqueado
- Permissões da API Key

### 2. Verificar no Painel da Evolution API

Acesse o painel de gerenciamento da Evolution API e verifique:

1. **API Keys / Segurança:**
   - Se há whitelist de IPs configurada
   - Se o seu IP atual está na lista permitida
   - Se a API Key tem permissão para criar instâncias

2. **URL do Painel:**
   ```
   https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/manager
   ```

3. **Configurações de Segurança:**
   - Procure por "IP Whitelist" ou "Allowed IPs"
   - Procure por "API Key Permissions" ou "Scopes"

### 3. Descobrir Seu IP Público

Para adicionar seu IP na whitelist, você precisa saber qual é:

```bash
# No Windows PowerShell:
Invoke-RestMethod -Uri "https://api.ipify.org?format=json"

# Ou acesse no navegador:
https://api.ipify.org
```

### 4. Solução Temporária: Usar Túnel (ngrok)

Se você precisar testar localmente enquanto o IP não é adicionado à whitelist, use ngrok:

```bash
# Instalar ngrok (se não tiver):
# https://ngrok.com/download

# Criar túnel para a porta 3007:
ngrok http 3007

# Use a URL fornecida pelo ngrok (ex: https://abc123.ngrok.io)
# Configure no .env:
# APP_URL=https://abc123.ngrok.io
```

**⚠️ IMPORTANTE:** O ngrok é apenas para desenvolvimento. Em produção, você deve:
- Adicionar o IP do servidor na whitelist da Evolution API
- Ou configurar a Evolution API para aceitar requisições de qualquer IP (menos seguro)

### 5. Testar com curl

Teste diretamente do terminal para verificar se o problema é do Node.js ou da API:

```bash
# No PowerShell:
$headers = @{
    "Content-Type" = "application/json"
    "apikey" = "78F68D01CE85-487F-ABE6-9685B4437541"
}
$body = @{
    instanceName = "test-curl"
    qrcode = $true
    integration = "EVOLUTION"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/instance/create" -Method Post -Headers $headers -Body $body
```

## Próximos Passos

1. **Execute o script de teste** para ver qual formato de autenticação funciona
2. **Verifique no painel** se há whitelist de IPs
3. **Se houver whitelist**, adicione seu IP público
4. **Se não resolver**, verifique se a API Key está correta e tem permissões adequadas

## Se Nada Funcionar

Pode ser necessário:
- Contatar o suporte da Evolution API
- Verificar a documentação oficial da sua versão específica
- Verificar se a API Key foi gerada corretamente
- Tentar gerar uma nova API Key





