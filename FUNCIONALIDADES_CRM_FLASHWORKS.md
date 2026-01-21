# 🚀 Funcionalidades do Flashworks CRM para Implementar

## 📋 Resumo

O **Flashworks** é um CRM focado em atendimento via WhatsApp com funcionalidades avançadas de automação, gestão de leads e produtividade. Este documento lista as principais funcionalidades que podemos adicionar ao nosso sistema.

---

## ✅ Funcionalidades Já Implementadas

- ✅ Chat dividido (lista + conversa)
- ✅ Envio de mensagens de texto
- ✅ Envio de emojis
- ✅ Envio de mídias (imagens, vídeos, documentos)
- ✅ Gravação e envio de áudio
- ✅ Sistema de Tags (estrutura no banco)
- ✅ Sistema de Tickets (estrutura no banco)
- ✅ Atribuição de conversas a usuários
- ✅ Status de conversas (OPEN, CLOSED, etc.)
- ✅ Prioridade de conversas
- ✅ Contador de não lidas

---

## 🎯 Funcionalidades para Implementar

### 1. 📌 **Respostas Rápidas (Quick Replies / Templates)**

**Descrição:** Mensagens pré-configuradas que podem ser enviadas com um clique ou atalho.

**Como funciona no Flashworks:**
- Botão de "⚡" ou "/" no input de mensagem
- Modal com lista de templates
- Atalhos como `/boasvindas`, `/preco`, etc.
- Templates podem incluir variáveis: `{{nome}}`, `{{empresa}}`

**Implementação:**
```typescript
// Model no Prisma
model QuickReply {
  id          String   @id @default(cuid())
  name        String   // Nome do template
  shortcut    String?  // Atalho (ex: /boasvindas)
  content     String   // Conteúdo da mensagem
  type        String   @default("TEXT") // TEXT, IMAGE, VIDEO
  mediaUrl    String?
  userId      String?  // Template pessoal ou global
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User?    @relation(fields: [userId], references: [id])
}
```

**Interface:**
- Botão "⚡" ao lado do input de mensagem
- Modal com busca e categorias
- Preview do template antes de enviar
- Suporte a variáveis dinâmicas

**Prioridade:** 🔴 Alta

---

### 2. 📅 **Agendamento de Mensagens**

**Descrição:** Programar mensagens para serem enviadas em data/hora específica.

**Como funciona no Flashworks:**
- Ícone de relógio no input
- Seletor de data/hora
- Lista de mensagens agendadas
- Possibilidade de cancelar/editar

**Implementação:**
```typescript
// Model no Prisma
model ScheduledMessage {
  id            String   @id @default(cuid())
  conversationId String
  userId        String
  content       String
  type          MessageType
  scheduledFor  DateTime
  status        String   @default("PENDING") // PENDING, SENT, CANCELLED
  mediaUrl      String?
  createdAt     DateTime @default(now())
  
  conversation  Conversation @relation(fields: [conversationId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
}

// Service com node-cron
import cron from 'node-cron';

// Verificar mensagens agendadas a cada minuto
cron.schedule('* * * * *', async () => {
  const messages = await prisma.scheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: new Date() }
    }
  });
  
  for (const msg of messages) {
    await sendScheduledMessage(msg);
  }
});
```

**Interface:**
- Botão "🕐" no input
- Modal com calendário e seletor de hora
- Lista de mensagens agendadas na sidebar
- Badge com contagem de agendadas

**Prioridade:** 🟡 Média

---

### 3. 📊 **Funil de Vendas (Kanban Board)**

**Descrição:** Visualização em colunas estilo Trello para organizar leads por estágio.

**Como funciona no Flashworks:**
- Colunas: "Novos", "Qualificando", "Proposta", "Fechamento", "Vendido"
- Cards arrastáveis entre colunas
- Filtros por tag, usuário, data
- Métricas por estágio

**Implementação:**
```typescript
// Adicionar campo stage na Conversation
model Conversation {
  // ... campos existentes
  stage        String?  // "NEW", "QUALIFYING", "PROPOSAL", "CLOSING", "WON", "LOST"
  stageOrder   Int?     // Ordem na coluna
}

// Nova página: KanbanView.tsx
// Usar biblioteca: react-beautiful-dnd ou @dnd-kit/core
```

**Interface:**
- Nova aba "Funil" no menu
- Colunas arrastáveis
- Cards com informações resumidas
- Drag & drop entre colunas
- Modal ao clicar no card

**Prioridade:** 🔴 Alta

---

### 4. 📝 **Notas Internas**

**Descrição:** Anotações privadas sobre o contato que apenas a equipe vê.

**Como funciona no Flashworks:**
- Sidebar na conversa com campo de notas
- Histórico de notas com data/autor
- Notas podem ser editadas/deletadas
- Busca por conteúdo das notas

**Implementação:**
```typescript
// Model no Prisma
model InternalNote {
  id            String   @id @default(cuid())
  conversationId String
  userId        String
  content       String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  conversation  Conversation @relation(fields: [conversationId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
}

// Adicionar relação em Conversation
model Conversation {
  // ... campos existentes
  internalNotes InternalNote[]
}
```

**Interface:**
- Sidebar expandível na área de chat
- Campo de texto para nova nota
- Lista de notas com data/autor
- Ícone de lápis para editar
- Ícone de lixeira para deletar

**Prioridade:** 🟡 Média

---

### 5. 🏷️ **Sistema de Tags Melhorado**

**Descrição:** Tags coloridas para categorizar e filtrar conversas.

**Como funciona no Flashworks:**
- Tags já existem no banco, mas precisam de interface
- Criar/editar tags com cores personalizadas
- Aplicar múltiplas tags por conversa
- Filtro por tags na lista de conversas

**Implementação:**
```typescript
// Já existe no schema, só precisa de interface
// Adicionar página de gerenciamento de tags
// Adicionar seletor de tags na conversa
// Adicionar filtro na lista de conversas
```

**Interface:**
- Botão "🏷️" na conversa para adicionar tags
- Modal com tags disponíveis (checkboxes)
- Criar nova tag com seletor de cor
- Filtro na sidebar esquerda por tags
- Badge colorido nas conversas

**Prioridade:** 🟡 Média

---

### 6. 📢 **Transmissão (Broadcasting) e Campanhas**

**Descrição:** Envio de mensagens em massa para múltiplos contatos.

**Como funciona no Flashworks:**
- Seleção múltipla de contatos
- Criar campanha com nome/descrição
- Agendar envio ou enviar imediatamente
- Relatório de entrega/leitura

**Implementação:**
```typescript
// Model no Prisma
model Campaign {
  id          String   @id @default(cuid())
  name        String
  description String?
  content     String
  type        MessageType
  mediaUrl    String?
  status      String   @default("DRAFT") // DRAFT, SCHEDULED, SENDING, COMPLETED
  scheduledFor DateTime?
  sentCount   Int      @default(0)
  totalCount  Int      @default(0)
  userId      String
  createdAt   DateTime @default(now())
  
  user        User              @relation(fields: [userId], references: [id])
  recipients  CampaignRecipient[]
}

model CampaignRecipient {
  id          String   @id @default(cuid())
  campaignId  String
  contactId   String
  status      String   @default("PENDING") // PENDING, SENT, DELIVERED, READ, FAILED
  sentAt      DateTime?
  deliveredAt DateTime?
  readAt      DateTime?
  
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  contact     Contact  @relation(fields: [contactId], references: [id])
}
```

**Interface:**
- Nova página "Campanhas"
- Botão "Criar Campanha"
- Seleção múltipla de contatos
- Preview da mensagem
- Agendamento opcional
- Dashboard com estatísticas

**Prioridade:** 🟢 Baixa

---

### 7. 🤖 **Automação de Fluxos (Chatbot Avançado)**

**Descrição:** Criar fluxos automáticos baseados em palavras-chave e condições.

**Como funciona no Flashworks:**
- Editor visual de fluxos (similar ao que já temos)
- Triggers: palavra-chave, horário, tag
- Ações: enviar mensagem, adicionar tag, transferir
- Condições: se/então/senão

**Implementação:**
```typescript
// Já temos BotFlowBuilderVisual.tsx
// Melhorar com:
// - Triggers de palavras-chave
// - Ações de tag
// - Condições mais complexas
// - Integração com conversas reais
```

**Interface:**
- Melhorar o editor de fluxos existente
- Adicionar trigger "Palavra-chave"
- Adicionar ação "Adicionar Tag"
- Adicionar ação "Transferir para usuário"

**Prioridade:** 🟡 Média

---

### 8. 📈 **Dashboard e Relatórios**

**Descrição:** Métricas e gráficos sobre atendimento e vendas.

**Como funciona no Flashworks:**
- Gráficos de mensagens por dia
- Taxa de resposta
- Tempo médio de resposta
- Conversões por estágio
- Top atendentes

**Implementação:**
```typescript
// Nova página: Reports.tsx
// Usar biblioteca: recharts ou chart.js
// Endpoints:
// GET /api/reports/messages-by-day
// GET /api/reports/response-time
// GET /api/reports/conversion-rate
// GET /api/reports/top-agents
```

**Interface:**
- Nova página "Relatórios"
- Cards com métricas principais
- Gráficos interativos
- Filtros por período
- Exportar para PDF/Excel

**Prioridade:** 🟡 Média

---

### 9. 👥 **Transferência de Conversas**

**Descrição:** Transferir conversa para outro atendente.

**Como funciona no Flashworks:**
- Botão "Transferir" na conversa
- Seletor de usuário
- Nota opcional sobre o motivo
- Notificação para o novo atendente

**Implementação:**
```typescript
// Endpoint
POST /api/conversations/:id/transfer
Body: { assignedToId: string, note?: string }

// Atualizar Conversation.assignedToId
// Criar InternalNote automático
// Notificar via Socket.IO
```

**Interface:**
- Botão "Transferir" no header da conversa
- Modal com lista de usuários
- Campo opcional de nota
- Confirmação

**Prioridade:** 🟡 Média

---

### 10. 🔍 **Busca Avançada**

**Descrição:** Buscar conversas, mensagens e contatos com filtros.

**Como funciona no Flashworks:**
- Barra de busca global
- Filtros: data, tag, usuário, status
- Busca em conteúdo de mensagens
- Busca em notas internas

**Implementação:**
```typescript
// Endpoint
GET /api/search?q=termo&type=conversations&filters=...

// Usar full-text search do PostgreSQL
// ou implementar busca com Prisma
```

**Interface:**
- Barra de busca no topo
- Filtros avançados
- Resultados em abas (Conversas, Contatos, Mensagens)
- Highlight dos termos encontrados

**Prioridade:** 🟢 Baixa

---

### 11. 📱 **Integração com Outros Canais**

**Descrição:** Além do WhatsApp, suportar Instagram, Facebook Messenger, etc.

**Como funciona no Flashworks:**
- Múltiplos canais na mesma interface
- Badge indicando o canal
- Configuração por canal

**Implementação:**
```typescript
// Já temos Channel model
// Adicionar novos tipos: INSTAGRAM, FACEBOOK, TELEGRAM
// Criar adapters para cada API
```

**Prioridade:** 🟢 Baixa (futuro)

---

### 12. 💬 **Respostas com IA (ChatGPT/Claude)**

**Descrição:** Sugestões de respostas geradas por IA.

**Como funciona no Flashworks:**
- Botão "✨ Sugerir resposta"
- IA analisa contexto da conversa
- Gera 3 opções de resposta
- Usuário escolhe e envia

**Implementação:**
```typescript
// Endpoint
POST /api/ai/suggest-reply
Body: { conversationId: string }

// Integrar com OpenAI ou Claude API
// Analisar últimas mensagens
// Gerar sugestões contextuais
```

**Interface:**
- Botão "✨" no input
- Modal com sugestões
- Botão "Usar" em cada sugestão
- Editar antes de enviar

**Prioridade:** 🟢 Baixa (futuro)

---

## 🎯 Priorização de Implementação

### Fase 1 - Essenciais (Alta Prioridade)
1. ✅ Respostas Rápidas (Quick Replies)
2. ✅ Funil de Vendas (Kanban)
3. ✅ Notas Internas

### Fase 2 - Produtividade (Média Prioridade)
4. ✅ Agendamento de Mensagens
5. ✅ Tags Melhorado
6. ✅ Transferência de Conversas
7. ✅ Dashboard e Relatórios

### Fase 3 - Avançado (Baixa Prioridade)
8. ✅ Broadcasting e Campanhas
9. ✅ Busca Avançada
10. ✅ Automação Avançada
11. ✅ Integração Multi-canal
12. ✅ IA para Sugestões

---

## 📊 Comparação: Sistema Atual vs Flashworks

| Funcionalidade | Sistema Atual | Flashworks | Prioridade |
|---------------|---------------|------------|------------|
| Chat dividido | ✅ | ✅ | - |
| Envio de mídias | ✅ | ✅ | - |
| Tags | ⚠️ (estrutura) | ✅ | 🟡 |
| Tickets | ⚠️ (estrutura) | ✅ | 🟡 |
| Respostas Rápidas | ❌ | ✅ | 🔴 |
| Funil de Vendas | ❌ | ✅ | 🔴 |
| Notas Internas | ❌ | ✅ | 🟡 |
| Agendamento | ❌ | ✅ | 🟡 |
| Broadcasting | ❌ | ✅ | 🟢 |
| Dashboard | ⚠️ (básico) | ✅ | 🟡 |
| Transferência | ❌ | ✅ | 🟡 |
| Busca Avançada | ❌ | ✅ | 🟢 |
| IA | ❌ | ⚠️ | 🟢 |

---

## 🚀 Próximos Passos

1. **Implementar Respostas Rápidas** (maior impacto na produtividade)
2. **Implementar Funil de Vendas** (essencial para vendas)
3. **Melhorar interface de Tags** (já tem estrutura)
4. **Adicionar Notas Internas** (complementa o perfil do contato)

---

## 💡 Dicas de Implementação

- **Reutilizar componentes:** Muitas funcionalidades podem compartilhar componentes
- **Socket.IO:** Usar para atualizações em tempo real (já implementado)
- **Prisma:** Aproveitar a estrutura existente
- **React DnD:** Para drag & drop no Kanban
- **node-cron:** Para agendamento de mensagens
- **Bibliotecas de gráficos:** recharts ou chart.js para dashboard

---

**Nota:** Este documento é um guia de referência. A ordem de implementação pode variar conforme as necessidades do projeto.

