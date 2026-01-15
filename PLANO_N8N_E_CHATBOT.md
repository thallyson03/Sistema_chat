# 🤖 Plano de Integração: n8n + Chatbot

## 📋 Visão Geral

Este documento detalha o plano para:
1. **Integração com n8n** - Automações e workflows externos
2. **Sistema de Chatbot** - Bots conversacionais automáticos

---

## 🔗 PARTE 1: INTEGRAÇÃO COM N8N

### 1.1 O que é n8n?
n8n é uma plataforma de automação de workflows open-source que permite criar automações complexas conectando diferentes serviços via webhooks, APIs e integrações.

### 1.2 Casos de Uso com n8n

#### Automações de Atendimento
- Respostas automáticas baseadas em palavras-chave
- Encaminhamento inteligente de conversas
- Atualização de status baseado em regras
- Notificações para outros sistemas

#### Automações de Vendas
- Criação automática de oportunidades
- Atualização de pipeline
- Envio de follow-ups
- Integração com ERPs

#### Automações de Marketing
- Campanhas segmentadas
- Sequências de nutrição
- A/B testing
- Integração com ferramentas de marketing

---

## 🏗️ ARQUITETURA DA INTEGRAÇÃO N8N

### 1.3 Webhooks de Saída (Sistema → n8n)

O sistema emitirá eventos via webhooks para o n8n quando:

#### Eventos de Mensagem
```typescript
POST {n8n_webhook_url}/message-received
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "messageId": "msg_123",
    "conversationId": "conv_456",
    "contactId": "contact_789",
    "channelId": "channel_001",
    "content": "Olá, preciso de ajuda",
    "type": "TEXT",
    "fromMe": false,
    "metadata": {
      "phone": "5511999999999",
      "contactName": "João Silva"
    }
  }
}
```

#### Eventos de Conversa
```typescript
POST {n8n_webhook_url}/conversation-updated
{
  "event": "conversation.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "conversationId": "conv_456",
    "status": "OPEN",
    "priority": "HIGH",
    "assignedToId": "user_123",
    "unreadCount": 5
  }
}
```

#### Eventos de Oportunidade (futuro)
```typescript
POST {n8n_webhook_url}/opportunity-created
{
  "event": "opportunity.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "opportunityId": "opp_123",
    "contactId": "contact_789",
    "value": 5000,
    "stage": "PROSPECTING"
  }
}
```

### 1.4 Webhooks de Entrada (n8n → Sistema)

O n8n poderá enviar comandos para o sistema via webhooks:

#### Enviar Mensagem
```typescript
POST /api/webhooks/n8n/send-message
{
  "conversationId": "conv_456",
  "content": "Olá! Como posso ajudar?",
  "type": "TEXT",
  "metadata": {
    "automationId": "auto_123",
    "trigger": "keyword_match"
  }
}
```

#### Atualizar Conversa
```typescript
POST /api/webhooks/n8n/update-conversation
{
  "conversationId": "conv_456",
  "status": "WAITING",
  "priority": "HIGH",
  "assignedToId": "user_123",
  "tags": ["urgente", "venda"]
}
```

#### Criar Oportunidade
```typescript
POST /api/webhooks/n8n/create-opportunity
{
  "contactId": "contact_789",
  "title": "Venda de Produto X",
  "value": 5000,
  "stage": "PROSPECTING",
  "source": "whatsapp"
}
```

---

## 🗄️ ESTRUTURA DE BANCO DE DADOS PARA N8N

### 1.5 Novos Modelos Prisma

```prisma
// Configuração de Webhooks para n8n
model WebhookConfig {
  id          String   @id @default(cuid())
  name        String
  url         String   // URL do webhook do n8n
  events      String[] // Eventos que devem ser enviados
  isActive    Boolean  @default(true)
  secret      String?  // Secret para validação
  channelId   String?  // Opcional: apenas para um canal
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  channel     Channel? @relation(fields: [channelId], references: [id], onDelete: SetNull)
  executions  WebhookExecution[]

  @@index([isActive])
  @@index([channelId])
}

// Histórico de execuções de webhooks
model WebhookExecution {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  status      String   // SUCCESS, FAILED, PENDING
  requestBody Json?
  responseBody Json?
  error       String?
  executedAt  DateTime @default(now())

  webhook     WebhookConfig @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId])
  @@index([executedAt])
  @@index([status])
}

// Automações configuradas
model Automation {
  id          String   @id @default(cuid())
  name        String
  description String?
  trigger     Json     // Configuração do trigger
  actions     Json     // Configuração das ações
  isActive    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  executions  AutomationExecution[]

  @@index([isActive])
}

// Execuções de automações
model AutomationExecution {
  id           String   @id @default(cuid())
  automationId String
  status       String   // SUCCESS, FAILED, RUNNING
  inputData    Json?
  outputData   Json?
  error        String?
  startedAt    DateTime @default(now())
  completedAt  DateTime?

  automation   Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)

  @@index([automationId])
  @@index([startedAt])
}
```

---

## 🤖 PARTE 2: SISTEMA DE CHATBOT

### 2.1 Arquitetura do Chatbot

O sistema de chatbot permitirá:
- Criar bots conversacionais
- Configurar fluxos de conversa
- Respostas automáticas baseadas em regras
- Integração com IA (opcional)
- Handoff para agentes humanos

### 2.2 Componentes do Chatbot

#### 1. Bot Definition (Definição do Bot)
- Nome, descrição, avatar
- Canal associado
- Idioma
- Status (ativo/inativo)

#### 2. Intents (Intenções)
- Palavras-chave/expressões que o bot reconhece
- Exemplo: "preço", "horário", "contato"

#### 3. Responses (Respostas)
- Mensagens que o bot envia
- Pode ser texto, imagem, botões, lista
- Suporte a variáveis dinâmicas

#### 4. Flows (Fluxos)
- Sequência de interações
- Condicionais (IF/THEN)
- Loops e iterações
- Integração com APIs externas

#### 5. Handoff Rules (Regras de Transferência)
- Quando transferir para agente humano
- Critérios: palavras-chave, sentimento, complexidade

---

## 🗄️ ESTRUTURA DE BANCO DE DADOS PARA CHATBOT

### 2.3 Novos Modelos Prisma

```prisma
// Definição do Bot
model Bot {
  id          String   @id @default(cuid())
  name        String
  description String?
  avatar      String?
  channelId   String
  language    String   @default("pt-BR")
  isActive    Boolean  @default(true)
  welcomeMessage String?
  fallbackMessage String? // Mensagem quando não entende
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  channel     Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  intents     Intent[]
  flows       Flow[]
  sessions    BotSession[]

  @@index([channelId])
  @@index([isActive])
}

// Intenções do Bot
model Intent {
  id          String   @id @default(cuid())
  botId       String
  name        String
  keywords    String[] // Palavras-chave que ativam esta intenção
  patterns    String[] // Regex patterns
  priority    Int      @default(0) // Prioridade de matching
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bot         Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  responses   Response[]
  flowSteps   FlowStep[]

  @@index([botId])
}

// Respostas do Bot
model Response {
  id          String   @id @default(cuid())
  intentId   String?
  flowStepId String?
  type       String   // TEXT, IMAGE, BUTTONS, LIST, QUICK_REPLIES
  content    String   // Conteúdo da resposta
  buttons    Json?    // Botões (se type = BUTTONS)
  mediaUrl   String?  // URL da mídia (se type = IMAGE/VIDEO)
  metadata   Json?    // Dados adicionais
  order      Int      @default(0) // Ordem de exibição
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  intent     Intent?  @relation(fields: [intentId], references: [id], onDelete: Cascade)
  flowStep   FlowStep? @relation(fields: [flowStepId], references: [id], onDelete: Cascade)

  @@index([intentId])
  @@index([flowStepId])
}

// Fluxos de Conversa
model Flow {
  id          String   @id @default(cuid())
  botId       String
  name        String
  description String?
  trigger     String   // Como o fluxo é ativado (intent, keyword, always)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bot         Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  steps       FlowStep[]

  @@index([botId])
  @@index([isActive])
}

// Passos do Fluxo
model FlowStep {
  id          String   @id @default(cuid())
  flowId      String
  intentId    String?  // Intent que ativa este passo
  type        String   // MESSAGE, CONDITION, API_CALL, HANDOFF, DELAY
  order       Int      // Ordem no fluxo
  config      Json     // Configuração específica do tipo
  nextStepId  String?  // Próximo passo (se não for condicional)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  flow        Flow     @relation(fields: [flowId], references: [id], onDelete: Cascade)
  intent      Intent?  @relation(fields: [intentId], references: [id], onDelete: SetNull)
  response    Response?
  conditions  FlowCondition[]

  @@index([flowId])
  @@index([intentId])
}

// Condições do Fluxo
model FlowCondition {
  id          String   @id @default(cuid())
  stepId      String
  condition   String   // Condição a verificar
  operator    String   // EQUALS, CONTAINS, GREATER_THAN, etc.
  value       String   // Valor a comparar
  trueStepId  String?  // Próximo passo se verdadeiro
  falseStepId String?  // Próximo passo se falso
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  step        FlowStep @relation(fields: [stepId], references: [id], onDelete: Cascade)

  @@index([stepId])
}

// Sessões do Bot (conversas ativas)
model BotSession {
  id            String   @id @default(cuid())
  botId         String
  conversationId String
  currentFlowId String?
  currentStepId String?
  context       Json?    // Contexto da conversa (variáveis)
  isActive      Boolean  @default(true)
  handoffToUserId String? // Se foi transferido para humano
  handoffAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  bot           Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  conversation  Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([conversationId])
  @@index([botId])
  @@index([isActive])
}

// Adicionar relação no modelo Conversation
// model Conversation {
//   ...
//   botSession  BotSession?
// }
```

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### 3.1 Serviços a Criar

#### WebhookService (para n8n)
```typescript
// src/services/webhookService.ts
export class WebhookService {
  // Registrar webhook do n8n
  async registerWebhook(data: RegisterWebhookData)
  
  // Emitir evento para n8n
  async emitEvent(event: string, data: any)
  
  // Processar webhook recebido do n8n
  async processIncomingWebhook(req: Request)
  
  // Listar webhooks configurados
  async listWebhooks(filters?: WebhookFilters)
}
```

#### BotService (para chatbot)
```typescript
// src/services/botService.ts
export class BotService {
  // Criar bot
  async createBot(data: CreateBotData)
  
  // Processar mensagem recebida (verificar se é bot)
  async processMessage(message: Message, conversation: Conversation)
  
  // Encontrar intent correspondente
  async matchIntent(message: string, botId: string)
  
  // Executar fluxo
  async executeFlow(flowId: string, session: BotSession, input: any)
  
  // Transferir para humano
  async handoffToHuman(sessionId: string, userId: string)
  
  // Obter resposta do bot
  async getBotResponse(intentId: string, context: any)
}
```

### 3.2 Controllers a Criar

#### WebhookController
```typescript
// src/controllers/webhookController.ts
export class WebhookController {
  // Registrar webhook do n8n
  async registerWebhook(req: AuthRequest, res: Response)
  
  // Listar webhooks
  async listWebhooks(req: AuthRequest, res: Response)
  
  // Atualizar webhook
  async updateWebhook(req: AuthRequest, res: Response)
  
  // Deletar webhook
  async deleteWebhook(req: AuthRequest, res: Response)
  
  // Receber webhook do n8n (público, com autenticação)
  async receiveWebhook(req: Request, res: Response)
}
```

#### BotController
```typescript
// src/controllers/botController.ts
export class BotController {
  // CRUD de bots
  async createBot(req: AuthRequest, res: Response)
  async listBots(req: AuthRequest, res: Response)
  async getBot(req: AuthRequest, res: Response)
  async updateBot(req: AuthRequest, res: Response)
  async deleteBot(req: AuthRequest, res: Response)
  
  // CRUD de intents
  async createIntent(req: AuthRequest, res: Response)
  async listIntents(req: AuthRequest, res: Response)
  async updateIntent(req: AuthRequest, res: Response)
  async deleteIntent(req: AuthRequest, res: Response)
  
  // CRUD de flows
  async createFlow(req: AuthRequest, res: Response)
  async listFlows(req: AuthRequest, res: Response)
  async updateFlow(req: AuthRequest, res: Response)
  async deleteFlow(req: AuthRequest, res: Response)
  
  // Testar bot
  async testBot(req: AuthRequest, res: Response)
}
```

### 3.3 Rotas a Criar

```typescript
// src/routes/webhookRoutes.ts (adicionar)
router.post('/n8n/register', webhookController.registerWebhook)
router.get('/n8n', webhookController.listWebhooks)
router.put('/n8n/:id', webhookController.updateWebhook)
router.delete('/n8n/:id', webhookController.deleteWebhook)
router.post('/n8n/receive', webhookController.receiveWebhook) // Público com secret

// src/routes/botRoutes.ts (novo)
router.post('/bots', botController.createBot)
router.get('/bots', botController.listBots)
router.get('/bots/:id', botController.getBot)
router.put('/bots/:id', botController.updateBot)
router.delete('/bots/:id', botController.deleteBot)

router.post('/bots/:id/intents', botController.createIntent)
router.get('/bots/:id/intents', botController.listIntents)
router.put('/intents/:id', botController.updateIntent)
router.delete('/intents/:id', botController.deleteIntent)

router.post('/bots/:id/flows', botController.createFlow)
router.get('/bots/:id/flows', botController.listFlows)
router.put('/flows/:id', botController.updateFlow)
router.delete('/flows/:id', botController.deleteFlow)

router.post('/bots/:id/test', botController.testBot)
```

---

## 🔄 FLUXO DE PROCESSAMENTO

### 4.1 Fluxo: Mensagem Recebida → Bot ou n8n

```
1. Mensagem chega via webhook (Evolution API)
   ↓
2. WebhookRoutes.processWebhook()
   ↓
3. Verificar se há bot ativo para o canal
   ↓
4a. Se SIM → BotService.processMessage()
   - Match de intent
   - Executar fluxo
   - Enviar resposta automática
   ↓
4b. Se NÃO → Verificar webhooks n8n configurados
   - Emitir evento para n8n
   - Aguardar resposta (opcional)
   ↓
5. Salvar mensagem no banco
   ↓
6. Atualizar conversa
```

### 4.2 Fluxo: n8n → Sistema

```
1. n8n executa workflow
   ↓
2. n8n envia webhook para /api/webhooks/n8n/receive
   ↓
3. WebhookController.receiveWebhook()
   - Validar secret
   - Processar comando
   ↓
4. Executar ação (enviar mensagem, atualizar conversa, etc.)
   ↓
5. Retornar resposta para n8n
```

---

## 📝 EXEMPLOS DE USO

### 5.1 Exemplo: Bot Simples de Atendimento

```typescript
// Bot: "Atendimento Básico"
// Intent: "saudacao"
// Keywords: ["olá", "oi", "bom dia", "boa tarde"]
// Response: "Olá! Como posso ajudar você hoje?"

// Intent: "horario"
// Keywords: ["horário", "funcionamento", "aberto"]
// Response: "Funcionamos de segunda a sexta, das 9h às 18h."

// Intent: "contato"
// Keywords: ["telefone", "contato", "falar"]
// Response: "Você pode nos contatar pelo WhatsApp ou email: contato@empresa.com"
// Action: HANDOFF (transferir para humano)
```

### 5.2 Exemplo: Automação n8n

```
Workflow n8n:
1. Trigger: Webhook (mensagem recebida)
2. IF: Mensagem contém "preço"
3. THEN: 
   - Buscar preços via API
   - Enviar mensagem com preços
4. ELSE IF: Mensagem contém "urgente"
5. THEN:
   - Atualizar prioridade para HIGH
   - Notificar supervisor
   - Atribuir para agente sênior
```

---

## 🎯 PLANO DE IMPLEMENTAÇÃO

### Fase 1: Estrutura Base (1-2 semanas)
1. ✅ Criar migrations do Prisma (WebhookConfig, Bot, Intent, etc.)
2. ✅ Criar modelos e serviços base
3. ✅ Criar rotas e controllers básicos
4. ✅ Testes unitários básicos

### Fase 2: Integração n8n (2-3 semanas)
1. ✅ Sistema de webhooks de saída (emitir eventos)
2. ✅ Sistema de webhooks de entrada (receber comandos)
3. ✅ Interface para configurar webhooks
4. ✅ Logs e histórico de execuções
5. ✅ Testes de integração

### Fase 3: Sistema de Bot Básico (3-4 semanas)
1. ✅ CRUD de bots
2. ✅ Sistema de intents e matching
3. ✅ Sistema de respostas simples
4. ✅ Processamento de mensagens
5. ✅ Interface de criação de bots

### Fase 4: Fluxos Avançados (2-3 semanas)
1. ✅ Builder de fluxos
2. ✅ Condicionais e loops
3. ✅ Integração com APIs externas
4. ✅ Handoff para humanos
5. ✅ Contexto e variáveis

### Fase 5: Interface e Polimento (2 semanas)
1. ✅ Interface visual para criar bots
2. ✅ Interface para configurar n8n
3. ✅ Testes de bot
4. ✅ Analytics de bots
5. ✅ Documentação

**Total Estimado: 10-14 semanas**

---

## 🔐 SEGURANÇA

### 6.1 Autenticação de Webhooks
- Secret key para validar webhooks do n8n
- HMAC signature
- Rate limiting
- IP whitelist (opcional)

### 6.2 Permissões
- Apenas ADMIN/SUPERVISOR podem criar bots
- Apenas ADMIN pode configurar webhooks n8n
- Logs de todas as ações

---

## 📊 MÉTRICAS E ANALYTICS

### 7.1 Métricas de Bot
- Mensagens processadas
- Taxa de resolução (sem handoff)
- Intents mais usados
- Fluxos mais executados
- Tempo médio de resposta

### 7.2 Métricas de n8n
- Webhooks enviados/recebidos
- Taxa de sucesso
- Tempo de resposta
- Erros mais comuns

---

## 🚀 PRÓXIMOS PASSOS

1. **Criar migrations do Prisma** para novos modelos
2. **Implementar WebhookService** básico
3. **Implementar BotService** básico
4. **Criar rotas e controllers**
5. **Criar interface de configuração**

Quer que eu comece implementando alguma parte específica?

