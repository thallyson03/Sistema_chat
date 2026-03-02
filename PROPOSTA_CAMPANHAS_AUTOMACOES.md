# 📢 Proposta: Sistema de Campanhas e Automações

## 🎯 Objetivo

Criar um sistema completo de campanhas de marketing e automações para envio de mensagens em massa, com agendamento, segmentação, templates e relatórios detalhados.

---

## 📊 Análise do Sistema Atual

### ✅ O que já temos:
- ✅ Sistema de contatos funcional
- ✅ Envio de mensagens individuais via Evolution API
- ✅ Suporte a mídias (imagem, áudio, vídeo, documento)
- ✅ Sistema de conversas e histórico
- ✅ Pipeline/CRM com deals
- ✅ Webhooks para receber mensagens

### 🔧 O que precisamos adicionar:
- 📢 Sistema de campanhas (envio em massa)
- 🤖 Automações baseadas em eventos
- 📅 Agendamento de mensagens
- 🎯 Segmentação de contatos
- 📝 Templates de mensagens
- 📊 Relatórios e estatísticas
- ⏱️ Controle de taxa de envio (rate limiting)

---

## 🏗️ Arquitetura Proposta

### 1. Modelo de Dados (Prisma Schema)

```prisma
// Status da campanha
enum CampaignStatus {
  DRAFT           // Rascunho
  SCHEDULED       // Agendada
  SENDING         // Enviando
  PAUSED          // Pausada
  COMPLETED       // Concluída
  CANCELLED       // Cancelada
}

// Tipo de campanha
enum CampaignType {
  BROADCAST       // Broadcast simples (envio único)
  SEQUENTIAL      // Sequencial (múltiplas mensagens com intervalo)
  AUTOMATION      // Automação (baseada em eventos)
}

// Status do destinatário
enum CampaignRecipientStatus {
  PENDING         // Aguardando envio
  SENT            // Enviado
  DELIVERED       // Entregue
  READ            // Lido
  FAILED          // Falhou
  OPTED_OUT       // Opt-out (saiu da lista)
}

// Modelo de Campanha
model Campaign {
  id              String          @id @default(cuid())
  name            String
  description     String?
  type            CampaignType    @default(BROADCAST)
  status          CampaignStatus  @default(DRAFT)
  channelId       String          // Canal usado para envio
  userId          String          // Criador da campanha
  
  // Conteúdo da mensagem
  content         String          // Texto da mensagem (suporta variáveis {{nome}}, {{telefone}}, etc.)
  messageType     MessageType     @default(TEXT) // TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT
  mediaUrl        String?         // URL da mídia (se aplicável)
  fileName        String?
  caption         String?
  
  // Agendamento
  scheduledFor    DateTime?       // Data/hora agendada
  timezone        String          @default("America/Sao_Paulo")
  
  // Configurações de envio
  sendInterval    Int?            // Intervalo entre envios (em segundos) - para rate limiting
  maxRecipients   Int?            // Limite de destinatários por execução
  startTime       String?         // Horário de início permitido (ex: "09:00")
  endTime         String?         // Horário de fim permitido (ex: "18:00")
  excludeWeekends Boolean         @default(false) // Não enviar em finais de semana
  
  // Segmentação
  segmentFilters  Json?           // Filtros de segmentação (ex: { tags: ["vip"], status: "OPEN" })
  
  // Estatísticas
  totalRecipients Int             @default(0)
  sentCount       Int             @default(0)
  deliveredCount  Int             @default(0)
  readCount       Int             @default(0)
  failedCount     Int             @default(0)
  optedOutCount   Int             @default(0)
  
  // Automação (se type = AUTOMATION)
  triggerType     String?         // EVENT, SCHEDULE, KEYWORD
  triggerConfig   Json?           // Configuração do trigger
  actions         Json?           // Ações a executar após trigger
  
  // Metadados
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  startedAt       DateTime?
  completedAt     DateTime?
  
  // Relações
  channel         Channel         @relation(fields: [channelId], references: [id], onDelete: Restrict)
  user            User            @relation("Campaigns", fields: [userId], references: [id], onDelete: Restrict)
  recipients      CampaignRecipient[]
  templates       CampaignTemplate[]
  
  @@index([userId])
  @@index([channelId])
  @@index([status])
  @@index([scheduledFor])
  @@index([type])
}

// Destinatários da campanha
model CampaignRecipient {
  id              String                    @id @default(cuid())
  campaignId      String
  contactId       String
  conversationId String?                   // Conversa criada/vinculada
  
  status          CampaignRecipientStatus   @default(PENDING)
  errorMessage    String?                  // Mensagem de erro se falhou
  
  // Timestamps
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?
  
  // Metadados
  metadata        Json?                    // Dados adicionais (ex: variáveis substituídas)
  
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
  
  // Relações
  campaign        Campaign                  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact         Contact                   @relation(fields: [contactId], references: [id], onDelete: Restrict)
  conversation    Conversation?             @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  
  @@unique([campaignId, contactId]) // Um contato só pode receber uma vez por campanha
  @@index([campaignId])
  @@index([contactId])
  @@index([status])
}

// Templates de mensagens para campanhas
model CampaignTemplate {
  id              String      @id @default(cuid())
  campaignId      String
  name            String      // Nome do template (ex: "Mensagem 1", "Follow-up 2")
  order           Int         // Ordem na sequência (para campanhas sequenciais)
  content         String      // Conteúdo da mensagem
  messageType     MessageType @default(TEXT)
  mediaUrl        String?
  delay           Int?        // Delay em horas antes de enviar este template (para sequenciais)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  campaign        Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@index([campaignId])
  @@index([order])
}

// Regras de automação
model AutomationRule {
  id              String      @id @default(cuid())
  name            String
  description     String?
  isActive        Boolean     @default(true)
  userId          String?
  
  // Trigger (gatilho)
  triggerType     String      // MESSAGE_RECEIVED, KEYWORD, TIME, CONTACT_CREATED, DEAL_STAGE_CHANGED
  triggerConfig   Json        // Configuração do trigger
  
  // Condições
  conditions      Json?      // Condições adicionais (ex: { tags: ["vip"], channel: "WHATSAPP" })
  
  // Ações
  actions         Json        // Ações a executar (ex: [{ type: "SEND_MESSAGE", content: "..." }])
  
  // Limites
  maxExecutions   Int?        // Máximo de execuções por contato
  cooldownPeriod  Int?        // Período de espera entre execuções (em minutos)
  
  // Estatísticas
  executionCount  Int         @default(0)
  lastExecutedAt  DateTime?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  user            User?       @relation("AutomationRules", fields: [userId], references: [id], onDelete: SetNull)
  executions      AutomationExecution[]
  
  @@index([userId])
  @@index([isActive])
  @@index([triggerType])
}

// Execuções de automação (log)
model AutomationExecution {
  id              String          @id @default(cuid())
  ruleId          String
  contactId       String
  conversationId  String?
  
  status          String          // SUCCESS, FAILED, SKIPPED
  errorMessage    String?
  executedAt      DateTime        @default(now())
  
  rule            AutomationRule  @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  contact         Contact         @relation(fields: [contactId], references: [id], onDelete: Restrict)
  conversation    Conversation?   @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  
  @@index([ruleId])
  @@index([contactId])
  @@index([executedAt])
}

// Adicionar relação em User
// model User {
//   ...
//   campaigns      Campaign[]           @relation("Campaigns")
//   automationRules AutomationRule[]    @relation("AutomationRules")
// }

// Adicionar relação em Contact
// model Contact {
//   ...
//   campaignRecipients CampaignRecipient[]
//   automationExecutions AutomationExecution[]
// }

// Adicionar relação em Conversation
// model Conversation {
//   ...
//   campaignRecipients CampaignRecipient[]
//   automationExecutions AutomationExecution[]
// }
```

---

## 🚀 Funcionalidades Principais

### 1. **Criação de Campanhas**

#### Tipos de Campanha:

**A. Broadcast Simples**
- Envio único de mensagem para múltiplos contatos
- Seleção manual de contatos ou filtros
- Suporte a variáveis personalizadas ({{nome}}, {{telefone}}, etc.)

**B. Campanha Sequencial**
- Múltiplas mensagens com intervalo configurável
- Exemplo: Mensagem 1 → aguardar 24h → Mensagem 2 → aguardar 48h → Mensagem 3
- Útil para nurture, follow-ups, etc.

**C. Automação Baseada em Eventos**
- Trigger: evento específico (nova mensagem, palavra-chave, mudança de status, etc.)
- Ações automáticas: enviar mensagem, adicionar tag, transferir conversa, etc.

#### Interface de Criação:
```
┌─────────────────────────────────────┐
│  Criar Nova Campanha                │
├─────────────────────────────────────┤
│  Nome: [________________]           │
│  Descrição: [___________]           │
│                                      │
│  Tipo: ○ Broadcast                  │
│        ○ Sequencial                  │
│        ○ Automação                   │
│                                      │
│  Canal: [WhatsApp ▼]                │
│                                      │
│  ┌─ Conteúdo ────────────────────┐ │
│  │ Mensagem:                      │ │
│  │ [________________________]     │ │
│  │                                │ │
│  │ Variáveis: {{nome}}, {{telefone}││
│  │ [📎 Anexar Mídia]              │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌─ Destinatários ─────────────────┐ │
│  │ ○ Todos os contatos            │ │
│  │ ○ Filtrar por:                 │ │
│  │   [✓] Tags                     │ │
│  │   [✓] Status da conversa       │ │
│  │   [✓] Canal                    │ │
│  │   [✓] Data de criação          │ │
│  │                                │ │
│  │ Ou selecionar manualmente:      │ │
│  │ [Selecionar Contatos]          │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌─ Agendamento ───────────────────┐ │
│  │ ○ Enviar agora                 │ │
│  │ ○ Agendar para:                │ │
│  │   [Data] [Hora]                │ │
│  │                                │ │
│  │ Configurações:                 │ │
│  │ [✓] Não enviar em finais de    │ │
│  │     semana                      │ │
│  │ Horário permitido:              │ │
│  │   [09:00] até [18:00]          │ │
│  │ Intervalo entre envios:        │ │
│  │   [2] segundos                 │ │
│  └────────────────────────────────┘ │
│                                      │
│  [Cancelar]  [Salvar Rascunho]     │
│              [Agendar Campanha]      │
└─────────────────────────────────────┘
```

### 2. **Segmentação de Contatos**

Filtros disponíveis:
- **Tags**: Contatos com tags específicas
- **Status da Conversa**: OPEN, WAITING, CLOSED, ARCHIVED
- **Canal**: WhatsApp, Telegram, etc.
- **Data de criação**: Criados entre X e Y
- **Última interação**: Última mensagem há X dias
- **Pipeline/Deal**: Contatos com deals em estágios específicos
- **Customizado**: Query JSON para filtros avançados

### 3. **Templates e Variáveis**

Variáveis disponíveis:
- `{{nome}}` - Nome do contato
- `{{telefone}}` - Telefone do contato
- `{{email}}` - Email do contato
- `{{canal}}` - Nome do canal
- `{{data}}` - Data atual formatada
- `{{hora}}` - Hora atual
- `{{deal.nome}}` - Nome do deal (se houver)
- `{{deal.valor}}` - Valor do deal (se houver)

Exemplo:
```
Olá {{nome}}! 

Seu número é {{telefone}}.

Atenciosamente,
Equipe de Atendimento
```

### 4. **Automações**

#### Triggers Disponíveis:

**A. Mensagem Recebida**
- Quando contato envia mensagem
- Condições: palavra-chave, horário, canal

**B. Palavra-chave**
- Quando mensagem contém palavra específica
- Exemplo: "promoção" → enviar catálogo

**C. Horário/Agendamento**
- Executar em horário específico
- Exemplo: Enviar boas-vindas às 9h para novos contatos

**D. Evento de Pipeline**
- Quando deal muda de estágio
- Exemplo: Deal ganho → enviar mensagem de agradecimento

**E. Contato Criado**
- Quando novo contato é criado
- Exemplo: Enviar mensagem de boas-vindas

#### Ações Disponíveis:
- ✅ Enviar mensagem
- ✅ Adicionar/remover tag
- ✅ Transferir conversa
- ✅ Criar deal no pipeline
- ✅ Atualizar campo customizado
- ✅ Enviar para webhook externo

### 5. **Rate Limiting e Controle de Envio**

- **Intervalo entre envios**: Evitar bloqueio do WhatsApp
- **Horário permitido**: Não enviar fora do horário comercial
- **Limite diário**: Máximo de mensagens por dia
- **Fila de envio**: Processar em background com fila

### 6. **Relatórios e Estatísticas**

Dashboard de campanha:
- Total de destinatários
- Enviados / Entregues / Lidos / Falhas
- Taxa de entrega / leitura
- Gráficos de evolução
- Lista de destinatários com status individual
- Exportar relatório (CSV/Excel)

---

## 🔧 Implementação Técnica

### Backend

#### 1. Serviços

**`campaignService.ts`**
```typescript
- createCampaign()
- updateCampaign()
- deleteCampaign()
- getCampaignById()
- getCampaigns()
- scheduleCampaign()
- startCampaign()
- pauseCampaign()
- resumeCampaign()
- cancelCampaign()
- getCampaignStats()
```

**`campaignExecutionService.ts`**
```typescript
- executeCampaign()
- processCampaignQueue()
- sendToRecipient()
- updateRecipientStatus()
- handleDeliveryStatus()
- handleReadStatus()
```

**`automationService.ts`**
```typescript
- createAutomationRule()
- updateAutomationRule()
- deleteAutomationRule()
- getAutomationRules()
- executeAutomation()
- checkTriggers()
```

#### 2. Workers/Jobs

**`campaignWorker.ts`** (usando node-cron ou Bull)
- Processar campanhas agendadas
- Executar envios em fila
- Atualizar status
- Rate limiting

#### 3. Controllers

**`campaignController.ts`**
- CRUD de campanhas
- Agendar/executar/pausar
- Estatísticas

**`automationController.ts`**
- CRUD de automações
- Executar manualmente
- Logs de execução

### Frontend

#### 1. Páginas

**`Campaigns.tsx`** - Lista de campanhas
- Cards com status, estatísticas
- Filtros e busca
- Ações: editar, pausar, cancelar, ver relatório

**`CampaignCreate.tsx`** - Criar/editar campanha
- Wizard multi-step:
  1. Informações básicas
  2. Conteúdo da mensagem
  3. Seleção de destinatários
  4. Agendamento e configurações
  5. Revisão e confirmação

**`CampaignDetail.tsx`** - Detalhes da campanha
- Estatísticas em tempo real
- Lista de destinatários com status
- Gráficos
- Ações de controle

**`Automations.tsx`** - Lista de automações
- Cards de regras
- Status ativo/inativo
- Estatísticas de execução

**`AutomationCreate.tsx`** - Criar/editar automação
- Editor visual de triggers e ações
- Teste de regra

---

## 📋 Roadmap de Implementação

### Fase 1: MVP (Campanhas Básicas)
1. ✅ Modelo de dados (Prisma)
2. ✅ Serviços básicos (CRUD)
3. ✅ Interface de criação simples
4. ✅ Envio em massa básico
5. ✅ Relatório simples

### Fase 2: Melhorias
1. ✅ Templates e variáveis
2. ✅ Segmentação avançada
3. ✅ Agendamento
4. ✅ Rate limiting
5. ✅ Campanhas sequenciais

### Fase 3: Automações
1. ✅ Sistema de triggers
2. ✅ Editor visual de automações
3. ✅ Execução automática
4. ✅ Logs e monitoramento

### Fase 4: Avançado
1. ✅ A/B Testing
2. ✅ Machine Learning (melhor horário)
3. ✅ Integração com APIs externas
4. ✅ Webhooks de automação

---

## 🎨 Interface Proposta

### Página Principal de Campanhas

```
┌─────────────────────────────────────────────────────────┐
│  📢 Campanhas                    [+ Nova Campanha]      │
├─────────────────────────────────────────────────────────┤
│  Filtros: [Todas ▼] [Status: Todos ▼] [Buscar...]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🎯 Promoção Black Friday                         │  │
│  │ Status: ● Enviando  |  Criada: 06/02/2025      │  │
│  │                                                   │  │
│  │ 📊 Estatísticas:                                 │  │
│  │   Total: 1.250  |  Enviados: 850  |  Entregues: 800│ │
│  │   Lidos: 450    |  Falhas: 50                    │  │
│  │                                                   │  │
│  │ [⏸️ Pausar] [📊 Ver Detalhes] [✏️ Editar]      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🤖 Boas-vindas Automáticas                       │  │
│  │ Status: ● Ativo  |  Tipo: Automação             │  │
│  │                                                   │  │
│  │ 📊 Execuções: 245 hoje                           │  │
│  │                                                   │  │
│  │ [⚙️ Configurar] [📊 Ver Logs] [✏️ Editar]      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Considerações Importantes

### 1. **Limites do WhatsApp**
- WhatsApp Business API tem limites de envio
- Respeitar rate limiting (máx. 1000 mensagens/hora por número)
- Usar fila para processar envios gradualmente
- Implementar retry automático para falhas temporárias

### 2. **Opt-out**
- Permitir que contatos saiam da lista
- Respeitar solicitações de não receber mais mensagens
- Lista de bloqueados

### 3. **Conformidade**
- LGPD: consentimento para envio
- Não enviar para contatos que não optaram
- Logs de consentimento

### 4. **Performance**
- Processar envios em background (fila)
- Usar workers separados
- Cache de contatos e filtros
- Otimizar queries de segmentação

---

## 💡 Próximos Passos

1. **Revisar proposta** e ajustar conforme necessidade
2. **Criar migration** do Prisma com novos modelos
3. **Implementar serviços** básicos
4. **Criar interface** de criação de campanha
5. **Implementar worker** de processamento
6. **Testar** com envios reais
7. **Adicionar automações** progressivamente

---

## 📝 Notas

- Sistema deve ser escalável para milhares de contatos
- Priorizar confiabilidade sobre velocidade
- Manter logs detalhados para auditoria
- Interface intuitiva para usuários não técnicos





