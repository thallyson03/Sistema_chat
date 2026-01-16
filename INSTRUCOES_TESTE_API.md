# 🧪 Como Testar a Autenticação da Evolution API

O erro 401 (Unauthorized) indica que a API Key não está sendo aceita. Vamos testar qual formato funciona:

## Teste Rápido

Execute o script de teste:

```bash
node scripts/testEvolutionAuth.js https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io SUA_API_KEY_AQUI
```

**Substitua `SUA_API_KEY_AQUI` pela sua API Key real.**

O script testará 5 formatos diferentes de autenticação:
1. Header `apikey`
2. Header `Authorization: Bearer {key}`
3. Header `Authorization: {key}` (sem Bearer)
4. Query parameter `?apikey={key}`
5. Header `X-API-Key`

## Após o Teste

O script mostrará qual formato funcionou. Com essa informação, podemos ajustar o código para usar o formato correto.

## Alternativa: Testar Manualmente

Se preferir testar manualmente, use o Postman ou curl:

### Com Header apikey:
```bash
curl -H "apikey: SUA_API_KEY" https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/
```

### Com Authorization Bearer:
```bash
curl -H "Authorization: Bearer SUA_API_KEY" https://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/
```

### Verificar Documentação

Consulte a documentação da Evolution API:
- URL do Manager: http://evo-lkg80sckkoc4osscgw040cow.vps.chatia.qzz.io/manager
- Documentação: https://doc.evolution-api.com/

## Possíveis Problemas

1. **API Key incorreta** - Verifique se está usando a API Key correta
2. **API Key sem permissões** - Verifique se a API Key tem permissão para criar instâncias
3. **URL incorreta** - Verifique se a URL está correta
4. **Formato de autenticação diferente** - A Evolution API pode usar um formato diferente do esperado






