import prisma from '../config/database';
import { MessageService } from './messageService';

const messageService = new MessageService();

export class JourneyExecutionService {
  /**
   * Executa uma jornada para um contato específico
   */
  async executeJourneyForContact(journeyId: string, contactId: string) {
    try {
      // Verificar se já existe uma execução pendente para este contato nesta jornada
      const existingExecution = await (prisma as any).journeyExecution.findFirst({
        where: {
          journeyId,
          contactId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (existingExecution) {
        console.log(`[JourneyExecution] Jornada ${journeyId} já está em execução para contato ${contactId}`);
        return;
      }

      // Criar registro de execução
      const execution = await (prisma as any).journeyExecution.create({
        data: {
          journeyId,
          contactId,
          status: 'IN_PROGRESS',
          messagesSent: 0,
        },
      });

      // Buscar jornada com todos os nós e edges
      const journey = await prisma.journey.findUnique({
        where: { id: journeyId },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
          edges: true,
        },
      });

      if (!journey || journey.status !== 'ACTIVE') {
        await (prisma as any).journeyExecution.update({
          where: { id: execution.id },
          data: { status: 'SKIPPED', completedAt: new Date() },
        });
        console.log(`[JourneyExecution] Jornada ${journeyId} não encontrada ou não está ativa`);
        return;
      }

      // Buscar contato e conversa
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          channel: true,
          conversations: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!contact) {
        console.log(`[JourneyExecution] Contato ${contactId} não encontrado`);
        return;
      }

      // Encontrar nó TRIGGER (deve ser o primeiro)
      const triggerNode = journey.nodes.find((n) => n.type === 'TRIGGER');
      if (!triggerNode) {
        console.log(`[JourneyExecution] Jornada ${journeyId} não tem nó TRIGGER`);
        return;
      }

      // Executar fluxo começando pelo trigger
      await this.executeNode(triggerNode, journey, contact, {}, execution.id);
      
      // Buscar execução atualizada para pegar o número correto de mensagens
      const updatedExecution = await (prisma as any).journeyExecution.findUnique({
        where: { id: execution.id },
        select: { messagesSent: true },
      });
      
      // Marcar execução como concluída
      await (prisma as any).journeyExecution.update({
        where: { id: execution.id },
        data: { 
          status: 'COMPLETED', 
          completedAt: new Date(),
          messagesSent: updatedExecution?.messagesSent || 0,
        },
      });
      
      console.log(`[JourneyExecution] ✅ Jornada ${journeyId} concluída para contato ${contactId}. Mensagens enviadas: ${updatedExecution?.messagesSent || 0}`);
    } catch (error: any) {
      console.error(`[JourneyExecution] Erro ao executar jornada ${journeyId} para contato ${contactId}:`, error);
      
      // Marcar execução como falha
      try {
        const failedExecution = await (prisma as any).journeyExecution.findFirst({
          where: { journeyId, contactId, status: 'IN_PROGRESS' },
        });
        
        if (failedExecution) {
          await (prisma as any).journeyExecution.update({
            where: { id: failedExecution.id },
            data: { 
              status: 'FAILED', 
              completedAt: new Date(),
              errors: { message: error.message, stack: error.stack },
            },
          });
        }
      } catch (updateError) {
        console.error('[JourneyExecution] Erro ao atualizar status de falha:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Executa um nó específico da jornada
   */
  private async executeNode(
    node: any,
    journey: any,
    contact: any,
    context: Record<string, any>,
    executionId: string
  ) {
    console.log(`[JourneyExecution] Executando nó ${node.id} (${node.type}): ${node.label}`);

    try {
      // Garantir que config seja sempre um objeto
      let config = node.config || {};
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.warn(`[JourneyExecution] Erro ao parsear config do nó ${node.id}:`, e);
          config = {};
        }
      }
      
      console.log(`[JourneyExecution] Config do nó ${node.id}:`, JSON.stringify(config, null, 2));

      switch (node.type) {
        case 'TRIGGER':
          // Trigger apenas inicia o fluxo, não faz nada
          break;

        case 'ACTION':
          await this.executeAction(node, config, contact, context, executionId);
          break;

        case 'CONDITION':
          // Condições serão avaliadas ao decidir qual edge seguir
          break;

        case 'CONTROL':
          if (config.controlType === 'delay') {
            // Delay será implementado com agendamento futuro
            const delayMs = this.calculateDelay(config.delayValue, config.delayUnit);
            console.log(`[JourneyExecution] Delay de ${delayMs}ms configurado`);
            // TODO: Implementar agendamento
          }
          break;
      }

      // Encontrar próximos nós conectados
      const outgoingEdges = journey.edges.filter((e: any) => e.sourceNodeId === node.id);
      
      for (const edge of outgoingEdges) {
        const nextNode = journey.nodes.find((n: any) => n.id === edge.targetNodeId);
        if (nextNode) {
          // Se for condição, avaliar antes de seguir
          if (nextNode.type === 'CONDITION') {
            const shouldFollow = this.evaluateCondition(nextNode, contact, context);
            if (shouldFollow) {
              await this.executeNode(nextNode, journey, contact, context, executionId);
            }
          } else {
            await this.executeNode(nextNode, journey, contact, context, executionId);
          }
        }
      }
    } catch (error: any) {
      console.error(`[JourneyExecution] Erro ao executar nó ${node.id}:`, error);
    }
  }

  /**
   * Executa uma ação
   */
  private async executeAction(node: any, config: any, contact: any, context: Record<string, any>, executionId: string) {
    const actionType = config.actionType;

    switch (actionType) {
      case 'send_message':
        const sent = await this.executeSendMessage(config, contact, context);
        if (sent) {
          // Incrementar contador de mensagens enviadas
          await (prisma as any).journeyExecution.update({
            where: { id: executionId },
            data: { messagesSent: { increment: 1 } },
          });
        }
        break;

      case 'add_tag':
        // TODO: Implementar adição de tag
        console.log(`[JourneyExecution] Adicionar tag: ${config.tagName}`);
        break;

      case 'remove_tag':
        // TODO: Implementar remoção de tag
        console.log(`[JourneyExecution] Remover tag: ${config.tagName}`);
        break;

      default:
        console.log(`[JourneyExecution] Tipo de ação não implementado: ${actionType}`);
    }
  }

  /**
   * Executa envio de mensagem
   * @returns true se a mensagem foi enviada com sucesso
   */
  private async executeSendMessage(config: any, contact: any, context: Record<string, any>): Promise<boolean> {
    if (!config.message || !config.channelId) {
      console.error('[JourneyExecution] Mensagem ou canal não configurado');
      return false;
    }

    // Substituir variáveis na mensagem
    let messageContent = config.message;
    messageContent = messageContent.replace(/\{\{nome\}\}/g, contact.name || 'Cliente');
    messageContent = messageContent.replace(/\{\{telefone\}\}/g, contact.phone || '');
    messageContent = messageContent.replace(/\{\{email\}\}/g, contact.email || '');

    // Buscar ou criar conversa
    let conversation = contact.conversations?.[0];
    if (!conversation) {
      // Criar conversa se não existir
      conversation = await prisma.conversation.create({
        data: {
          channelId: config.channelId,
          contactId: contact.id,
          status: 'OPEN',
        },
      });
    }

    // Buscar um usuário do sistema para enviar a mensagem
    const systemUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!systemUser) {
      console.error('[JourneyExecution] Nenhum usuário ADMIN encontrado para enviar mensagem');
      return false;
    }

    // Enviar mensagem
    try {
      await messageService.sendMessage({
        conversationId: conversation.id,
        userId: systemUser.id,
        content: messageContent,
        type: 'TEXT',
      });
      console.log(`[JourneyExecution] ✅ Mensagem enviada para contato ${contact.id}: "${messageContent.substring(0, 50)}..."`);
      return true;
    } catch (error: any) {
      console.error(`[JourneyExecution] ❌ Erro ao enviar mensagem:`, error);
      return false;
    }
  }

  /**
   * Avalia uma condição
   */
  private evaluateCondition(node: any, contact: any, context: Record<string, any>): boolean {
    const config = node.config || {};
    const conditionType = config.conditionType;
    const operator = config.operator || 'equals';
    const value = config.value;

    // Implementação básica - pode ser expandida
    switch (conditionType) {
      case 'has_tag':
        // TODO: Verificar se contato tem tag
        return true; // Placeholder
      default:
        return true;
    }
  }

  /**
   * Calcula delay em milissegundos
   */
  private calculateDelay(value: number, unit: string): number {
    switch (unit) {
      case 'minutes':
        return value * 60 * 1000;
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 60 * 60 * 1000; // Default: horas
    }
  }

  /**
   * Executa uma jornada para todos os contatos de uma lista
   */
  async executeJourneyForAllContactsInList(journeyId: string, listId: string) {
    try {
      // Buscar todos os contatos da lista
      const listMembers = await prisma.contactListMember.findMany({
        where: { listId },
        include: {
          contact: true,
        },
      });

      console.log(`[JourneyExecution] Executando jornada ${journeyId} para ${listMembers.length} contatos da lista ${listId}`);

      // Executar jornada para cada contato (com delay para não sobrecarregar)
      for (let i = 0; i < listMembers.length; i++) {
        const member = listMembers[i];
        
        try {
          await this.executeJourneyForContact(journeyId, member.contactId);
          
          // Pequeno delay entre execuções para não sobrecarregar
          if (i < listMembers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo entre execuções
          }
        } catch (error: any) {
          console.error(`[JourneyExecution] Erro ao executar jornada para contato ${member.contactId}:`, error);
          // Continuar com os próximos contatos mesmo se um falhar
        }
      }

      console.log(`[JourneyExecution] ✅ Jornada ${journeyId} executada para ${listMembers.length} contatos da lista ${listId}`);
    } catch (error: any) {
      console.error(`[JourneyExecution] Erro ao executar jornada para todos os contatos da lista:`, error);
      throw error;
    }
  }

  /**
   * Verifica se um contato deve entrar em uma jornada baseado no trigger
   */
  async checkTrigger(triggerNode: any, contactId: string, eventType: string, eventData?: any): Promise<boolean> {
    const config = triggerNode.config || {};
    const triggerType = config.triggerType;

    switch (triggerType) {
      case 'new_contact':
        return eventType === 'contact_created';
      
      case 'new_conversation':
        return eventType === 'conversation_created';
      
      case 'message_received':
        return eventType === 'message_received';
      
      case 'tag_added':
        return eventType === 'tag_added' && eventData?.tagName === config.tagName;
      
      case 'list_added':
        return eventType === 'list_added' && eventData?.listId === config.listId;
      
      case 'manual':
        return false; // Manual precisa ser acionado via API
      
      default:
        return false;
    }
  }
}

