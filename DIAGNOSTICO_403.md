# 🔍 Diagnóstico do Erro 403

## Possíveis Causas:

1. **Token não está sendo enviado** - Verifique no Network do navegador
2. **Token inválido/expirado** - Faça login novamente
3. **JWT_SECRET mudou** - Se reiniciou o servidor, o token antigo pode estar inválido
4. **Token não tem a role correta** - Usuário precisa ser ADMIN ou SUPERVISOR para criar canais

## ✅ Soluções:

### 1. Verificar se o Token está Sendo Enviado

Abra o DevTools do navegador (F12):
1. Vá em **Network** (Rede)
2. Recarregue a página
3. Clique na requisição `/api/channels`
4. Vá em **Headers** > **Request Headers**
5. Verifique se há: `Authorization: Bearer ...`

### 2. Verificar se o Token é Válido

No console do navegador, execute:
```javascript
const token = localStorage.getItem('token');
console.log('Token:', token ? 'Existe' : 'Não existe');
console.log('Token length:', token?.length);
```

### 3. Fazer Login Novamente

Se o token estiver inválido:
1. Faça logout
2. Faça login novamente
3. Isso gerará um novo token

### 4. Verificar no Servidor

Veja os logs do servidor. Deve mostrar a requisição chegando e o erro.

## 🛠️ Teste Rápido:

1. Abra o console do navegador (F12)
2. Execute:
```javascript
// Verificar token
const token = localStorage.getItem('token');
console.log('Token:', token);

// Testar requisição manual
fetch('http://localhost:3007/api/channels', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(d => console.log('Resposta:', d))
.catch(e => console.error('Erro:', e));
```

Se ainda der 403, o problema pode ser:
- Token expirado (faça login novamente)
- JWT_SECRET diferente no servidor







