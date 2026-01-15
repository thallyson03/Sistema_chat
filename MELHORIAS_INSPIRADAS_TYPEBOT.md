# Melhorias Inspiradas no Typebot

## 📊 Comparação: Nosso Sistema vs Typebot

### ✅ O que já temos implementado:

1. **Fluxo Visual (Graph)**
   - ✅ Interface drag-and-drop com React Flow
   - ✅ Nós conectáveis (edges)
   - ✅ Zoom e pan
   - ✅ Minimap

2. **Tipos de Blocos Básicos**
   - ✅ MESSAGE (mensagens do bot)
   - ✅ CONDITION (condições lógicas)
   - ✅ HANDOFF (transferência para humano)
   - ✅ DELAY (aguardar tempo)

3. **Botões em Mensagens**
   - ✅ Botões configuráveis
   - ✅ Conexões rotuladas com texto dos botões

4. **Estrutura de Dados**
   - ✅ Fluxos (Flows)
   - ✅ Steps (passos do fluxo)
   - ✅ Condições (FlowCondition)
   - ✅ Respostas (Response)

---

## 🚀 Melhorias Prioritárias (Baseadas no Typebot)

### 1. **Variáveis e Contexto** ⭐⭐⭐ (ALTA PRIORIDADE)

**O que o Typebot faz:**
- Permite criar variáveis globais e locais
- Usa variáveis em mensagens: `Olá, {{firstName}}!`
- Suporta formatação JavaScript inline: `{{price.toFixed(2)}}`
- Variáveis pré-preenchidas via URL ou contexto

**Como implementar no nosso sistema:**

#### 1.1. Adicionar modelo de Variáveis no Prisma:

```prisma
model BotVariable {
  id          String   @id @default(cuid())
  botId       String
  name        String   // Nome da variável (ex: "firstName")
  type        String   // STRING, NUMBER, BOOLEAN, DATE
  defaultValue String? // Valor padrão
  isGlobal    Boolean  @default(false) // Variável global ou de sessão
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bot         Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, name])
  @@index([botId])
}
```

#### 1.2. Adicionar contexto no BotSession:

```prisma
// Já temos context: Json? no BotSession, mas podemos melhorar
// Adicionar métodos para gerenciar variáveis no botService
```

#### 1.3. Parser de variáveis em mensagens:

```typescript
// Função para substituir {{variavel}} nas mensagens
function parseVariables(content: string, context: Record<string, any>): string {
  return content.replace(/\{\{(\w+)(?:\.(\w+))?\}\}/g, (match, varName, method) => {
    const value = context[varName];
    if (value === undefined) return match;
    
    // Suportar métodos JavaScript simples
    if (method === 'toUpperCase') return String(value).toUpperCase();
    if (method === 'toLowerCase') return String(value).toLowerCase();
    if (method === 'toFixed' && typeof value === 'number') {
      return value.toFixed(2);
    }
    
    return value;
  });
}
```

#### 1.4. Bloco SET_VARIABLE:

Adicionar novo tipo de step:
```prisma
// No FlowStep.type, adicionar: "SET_VARIABLE"
```

---

### 2. **Blocos de Input (Captura de Dados)** ⭐⭐⭐ (ALTA PRIORIDADE)

**O que o Typebot faz:**
- Blocos específicos para capturar diferentes tipos de dados:
  - Texto livre
  - Número
  - Email
  - Telefone
  - Data
  - Escolha única (radio)
  - Escolha múltipla (checkbox)
  - Upload de arquivo

**Como implementar:**

#### 2.1. Adicionar tipo INPUT no FlowStep:

```prisma
// No FlowStep.type, adicionar: "INPUT"
// No FlowStep.config, adicionar:
// {
//   inputType: "TEXT" | "NUMBER" | "EMAIL" | "PHONE" | "DATE" | "CHOICE",
//   placeholder: string,
//   validation: {
//     required: boolean,
//     minLength?: number,
//     maxLength?: number,
//     pattern?: string (regex),
//     min?: number,
//     max?: number
//   },
//   variableName: string, // Onde salvar a resposta
//   options?: string[] // Para CHOICE
// }
```

#### 2.2. Criar componente InputNode no frontend:

```typescript
const InputNode = ({ data, selected }: any) => {
  const inputType = data.config?.inputType || 'TEXT';
  const icons = {
    TEXT: '📝',
    NUMBER: '🔢',
    EMAIL: '📧',
    PHONE: '📱',
    DATE: '📅',
    CHOICE: '☑️'
  };
  
  return (
    <div style={{...}}>
      <div>{icons[inputType]} Input: {inputType}</div>
      <div>{data.config?.placeholder || 'Aguardando resposta...'}</div>
    </div>
  );
};
```

---

### 3. **Eventos e Validações** ⭐⭐ (MÉDIA PRIORIDADE)

**O que o Typebot faz:**
- **Reply Event**: Executa quando usuário responde
- **Invalid Reply Event**: Executa quando resposta não passa na validação
- **Command Event**: Executa quando usuário envia comando específico (ex: "/help")

**Como implementar:**

#### 3.1. Adicionar modelo de Eventos:

```prisma
model FlowEvent {
  id          String   @id @default(cuid())
  flowId      String
  stepId      String?  // Step que dispara o evento
  type        String   // REPLY, INVALID_REPLY, COMMAND, TIMEOUT
  condition   String?  // Condição para disparar (ex: comando "/help")
  targetStepId String  // Step para onde redirecionar
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  flow        Flow     @relation(fields: [flowId], references: [id], onDelete: Cascade)
  step        FlowStep? @relation(fields: [stepId], references: [id], onDelete: Cascade)
  targetStep  FlowStep @relation("EventTarget", fields: [targetStepId], references: [id])

  @@index([flowId])
  @@index([stepId])
}
```

#### 3.2. Lógica de validação no botService:

```typescript
async validateInput(step: FlowStep, userInput: string): Promise<boolean> {
  const validation = step.config?.validation;
  if (!validation) return true;

  if (validation.required && !userInput.trim()) return false;
  if (validation.minLength && userInput.length < validation.minLength) return false;
  if (validation.maxLength && userInput.length > validation.maxLength) return false;
  if (validation.pattern && !new RegExp(validation.pattern).test(userInput)) return false;
  
  // Validações específicas por tipo
  if (step.config.inputType === 'EMAIL') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);
  }
  if (step.config.inputType === 'PHONE') {
    return /^\+?[\d\s\-\(\)]+$/.test(userInput);
  }
  
  return true;
}
```

---

### 4. **Blocos de Integração (HTTP/Webhook)** ⭐⭐ (MÉDIA PRIORIDADE)

**O que o Typebot faz:**
- Bloco HTTP Request: Chama API externa imediatamente
- Bloco Webhook: Pausa e espera callback externo
- Pode usar variáveis na URL e body
- Pode salvar resposta em variável

**Como implementar:**

#### 4.1. Adicionar tipo API_CALL (já existe no schema, mas precisa implementar):

```typescript
// No FlowStep.config para API_CALL:
{
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string, // Pode ter {{variavel}}
  headers: Record<string, string>,
  body: string, // JSON string, pode ter {{variavel}}
  variableName?: string, // Onde salvar a resposta
  timeout?: number
}
```

#### 4.2. Implementar execução no botService:

```typescript
async executeApiCall(step: FlowStep, context: Record<string, any>): Promise<any> {
  const config = step.config;
  let url = parseVariables(config.url, context);
  let body = config.body ? parseVariables(config.body, context) : undefined;
  
  const response = await fetch(url, {
    method: config.method,
    headers: config.headers || {},
    body: body,
  });
  
  const data = await response.json();
  
  // Salvar em variável se especificado
  if (config.variableName) {
    context[config.variableName] = data;
  }
  
  return data;
}
```

---

### 5. **Export/Import de Fluxos** ⭐ (BAIXA PRIORIDADE, mas útil)

**O que o Typebot faz:**
- Exporta fluxo completo em JSON
- Importa para criar novo bot
- Permite compartilhar e reutilizar fluxos

**Como implementar:**

#### 5.1. Endpoint de Export:

```typescript
// GET /api/bots/flows/:flowId/export
async exportFlow(flowId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: {
      steps: {
        include: {
          response: true,
          conditions: true,
        }
      }
    }
  });
  
  return {
    version: "1.0",
    name: flow.name,
    description: flow.description,
    steps: flow.steps.map(step => ({
      id: step.id,
      type: step.type,
      order: step.order,
      config: step.config,
      position: step.position,
      response: step.response,
      conditions: step.conditions,
    })),
    createdAt: new Date().toISOString(),
  };
}
```

#### 5.2. Endpoint de Import:

```typescript
// POST /api/bots/flows/import
async importFlow(botId: string, flowData: any) {
  // Criar novo fluxo a partir do JSON
  // Gerar novos IDs para steps
  // Manter estrutura de conexões
}
```

---

### 6. **Melhorias na Interface Visual** ⭐⭐ (MÉDIA PRIORIDADE)

#### 6.1. Snap to Grid:
```typescript
// No ReactFlow, adicionar:
snapToGrid={true}
snapGrid={[20, 20]}
```

#### 6.2. Grupos de Blocos:
```typescript
// Permitir selecionar múltiplos nós e mover juntos
// Adicionar background colorido para grupos
```

#### 6.3. Atalhos de Teclado:
- `Ctrl+S`: Salvar fluxo
- `Delete`: Deletar nó selecionado
- `Ctrl+Z`: Desfazer
- `Ctrl+Y`: Refazer
- `Ctrl+D`: Duplicar nó

#### 6.4. Validação Visual:
- Mostrar erros em nós (ex: step sem conexão, variável não definida)
- Indicador de fluxo completo (todos os caminhos levam ao fim)

---

### 7. **Blocos de Controle de Fluxo** ⭐ (BAIXA PRIORIDADE)

#### 7.1. Bloco JUMP:
- Pula para outro step específico
- Útil para loops e redirecionamentos

#### 7.2. Bloco RETURN:
- Volta ao ponto anterior após desvio

#### 7.3. Bloco SPLIT:
- Divide o fluxo em múltiplos caminhos paralelos
- Útil para enviar múltiplas mensagens simultaneamente

---

## 📋 Plano de Implementação Sugerido

### Fase 1: Fundamentos (1-2 semanas)
1. ✅ Variáveis básicas (criar, usar em mensagens)
2. ✅ Bloco SET_VARIABLE
3. ✅ Parser de variáveis em mensagens

### Fase 2: Captura de Dados (1-2 semanas)
1. ✅ Bloco INPUT com tipos básicos (TEXT, NUMBER, EMAIL)
2. ✅ Validações básicas
3. ✅ Salvar resposta em variável

### Fase 3: Validações e Eventos (1 semana)
1. ✅ Invalid Reply Event
2. ✅ Validação visual no frontend
3. ✅ Mensagens de erro customizáveis

### Fase 4: Integrações (1-2 semanas)
1. ✅ Bloco API_CALL (HTTP Request)
2. ✅ Usar variáveis em URL/body
3. ✅ Salvar resposta em variável

### Fase 5: Melhorias de UX (1 semana)
1. ✅ Export/Import
2. ✅ Snap to grid
3. ✅ Atalhos de teclado
4. ✅ Validação visual de fluxo

---

## 🎯 Próximos Passos Imediatos

1. **Adicionar Variáveis ao Schema** (Prisma)
2. **Criar CRUD de Variáveis** (Backend)
3. **Implementar Parser de Variáveis** (botService)
4. **Adicionar UI para Gerenciar Variáveis** (Frontend)
5. **Atualizar Mensagens para Usar Variáveis**

Quer que eu comece implementando alguma dessas melhorias agora?

