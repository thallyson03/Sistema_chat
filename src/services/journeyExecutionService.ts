import prisma from '../config/database';
import { MessageService } from './messageService';

const messageService = new MessageService();

export class JourneyExecutionService {
  private readonly MAX_SYNC_DELAY_MS = 30_000;

  private parseNodeConfig(config: any): Record<string, any> {
    if (!config) return {};
    if (typeof config === 'string') {
      try {
        return JSON.parse(config);
      } catch {
        return {};
      }
    }
    if (typeof config === 'object') return config;
    return {};
  }

  /**
   * Processa eventos de runtime e dispara jornadas compatíveis
   */
  async processEvent(
    eventType: 'contact_created' | 'conversation_created' | 'message_received' | 'tag_added' | 'list_added',
    payload: {
      contactId: string;
      channelId?: string | null;
      conversationId?: string | null;
      tagName?: string | null;
      listId?: string | null;
      messageContent?: string | null;
    },
  ) {
    try {
      if (!payload.contactId) return;

      const activeJourneys = await prisma.journey.findMany({
        where: { status: 'ACTIVE' },
        include: {
          nodes: {
            where: { type: 'TRIGGER' },
            select: { id: true, config: true },
          },
        },
      });

      for (const journey of activeJourneys) {
        const triggerNode = journey.nodes[0];
        if (!triggerNode) continue;

        const config = this.parseNodeConfig(triggerNode.config);
        const triggerType = String(config.triggerType || 'manual');

        if (triggerType === 'manual') continue;

        const configuredChannelId = String(config.channelId || '').trim();
        if (configuredChannelId && payload.channelId && configuredChannelId !== payload.channelId) {
          continue;
        }
        if (configuredChannelId && !payload.channelId) {
          continue;
        }

        const shouldRun = await this.checkTrigger(triggerNode, payload.contactId, eventType, {
          ...payload,
          ...config,
        });
        if (!shouldRun) continue;

        await this.executeJourneyForContact(journey.id, payload.contactId, {
          eventType,
          channelId: payload.channelId || null,
          conversationId: payload.conversationId || null,
          tagName: payload.tagName || null,
          listId: payload.listId || null,
          messageContent: payload.messageContent || null,
        });
      }
    } catch (error: any) {
      console.error('[JourneyExecution] Erro ao processar evento de trigger:', error?.message || error);
    }
  }

  /**
   * Executa uma jornada para um contato específico
   */
  async executeJourneyForContact(
    journeyId: string,
    contactId: string,
    initialContext: Record<string, any> = {},
  ) {
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
      await this.executeNode(triggerNode, journey, contact, initialContext || {}, execution.id);
      
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
  ): Promise<{ halt: boolean }> {
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

      let selectedEdges: any[] | null = null;
      let shouldHaltFlow = false;

      switch (node.type) {
        case 'TRIGGER':
          // Trigger apenas inicia o fluxo, não faz nada
          break;

        case 'ACTION':
          await this.executeAction(node, config, contact, context, executionId);
          break;

        case 'CONDITION': {
          const conditionResult = await this.evaluateCondition(node, contact, context);
          selectedEdges = this.selectConditionEdges(journey, node.id, conditionResult);
          break;
        }

        case 'CONTROL':
          if (config.controlType === 'delay') {
            const delayMs = this.calculateDelay(config.delayValue, config.delayUnit);
            const effectiveDelay = Math.max(0, Math.min(delayMs, this.MAX_SYNC_DELAY_MS));
            if (effectiveDelay > 0) {
              await new Promise((resolve) => setTimeout(resolve, effectiveDelay));
            }
          } else if (config.controlType === 'split') {
            selectedEdges = this.selectSplitEdges(journey, node.id, config);
          } else if (config.controlType === 'wait_event') {
            const expectedEventType = String(config.eventType || '').trim();
            const currentEventType = String(context.eventType || '').trim();
            if (expectedEventType && currentEventType !== expectedEventType) {
              shouldHaltFlow = true;
            }
          } else if (config.controlType === 'loop') {
            selectedEdges = this.selectLoopEdges(journey, node.id, config, context);
            const loopDelayMs = Number(context.__pendingLoopDelayMs || 0);
            if (loopDelayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, loopDelayMs));
              context.__pendingLoopDelayMs = 0;
            }
          } else if (config.controlType === 'stop') {
            shouldHaltFlow = true;
          }
          break;
      }

      if (shouldHaltFlow) {
        return { halt: true };
      }

      // Encontrar próximos nós conectados
      const outgoingEdges = selectedEdges || journey.edges.filter((e: any) => e.sourceNodeId === node.id);
      
      for (const edge of outgoingEdges) {
        const nextNode = journey.nodes.find((n: any) => n.id === edge.targetNodeId);
        if (nextNode) {
          const childResult = await this.executeNode(nextNode, journey, contact, context, executionId);
          if (childResult.halt) {
            return { halt: true };
          }
        }
      }
      return { halt: false };
    } catch (error: any) {
      console.error(`[JourneyExecution] Erro ao executar nó ${node.id}:`, error);
      return { halt: false };
    }
  }

  private selectConditionEdges(journey: any, nodeId: string, conditionResult: boolean): any[] {
    const outgoingEdges = journey.edges.filter((e: any) => e.sourceNodeId === nodeId);
    if (outgoingEdges.length <= 1) return outgoingEdges;

    const trueEdge = outgoingEdges.find((edge: any) =>
      /^(true|sim|yes|1)$/i.test(String(edge.label || '').trim()),
    );
    const falseEdge = outgoingEdges.find((edge: any) =>
      /^(false|nao|não|no|0)$/i.test(String(edge.label || '').trim()),
    );

    if (conditionResult && trueEdge) return [trueEdge];
    if (!conditionResult && falseEdge) return [falseEdge];

    return [conditionResult ? outgoingEdges[0] : outgoingEdges[1] || outgoingEdges[0]];
  }

  private selectSplitEdges(journey: any, nodeId: string, config: any): any[] {
    const outgoingEdges = journey.edges.filter((e: any) => e.sourceNodeId === nodeId);
    if (outgoingEdges.length <= 1) return outgoingEdges;

    const percentA = Number(config.splitPercent || 50);
    const clampedA = Math.max(0, Math.min(100, Number.isFinite(percentA) ? percentA : 50));
    const random = Math.random() * 100;
    return [random < clampedA ? outgoingEdges[0] : outgoingEdges[1] || outgoingEdges[0]];
  }

  private selectLoopEdges(journey: any, nodeId: string, config: any, context: Record<string, any>): any[] {
    const outgoingEdges = journey.edges.filter((e: any) => e.sourceNodeId === nodeId);
    if (outgoingEdges.length === 0) return [];
    if (!context.__loopState) context.__loopState = {};

    const maxCount = Math.max(1, Number(config.loopCount || 1));
    const currentCount = Number(context.__loopState[nodeId] || 0);
    const willLoop = currentCount < maxCount - 1;
    context.__loopState[nodeId] = currentCount + 1;

    if (willLoop) {
      const loopDelay = this.calculateDelay(config.loopDelay || 0, config.loopDelayUnit || 'minutes');
      const effectiveDelay = Math.max(0, Math.min(loopDelay, this.MAX_SYNC_DELAY_MS));
      if (effectiveDelay > 0) {
        // Delay síncrono curto para evitar bloquear execução por longos períodos.
          context.__pendingLoopDelayMs = effectiveDelay;
      }
      return [outgoingEdges[0]];
    }
    return [outgoingEdges[1] || outgoingEdges[0]];
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
        await this.executeAddTag(config, contact);
        break;

      case 'remove_tag':
        await this.executeRemoveTag(config, contact);
        break;

      case 'update_field':
        await this.executeUpdateField(config, contact);
        break;

      case 'add_to_list':
        await this.executeAddToList(config, contact);
        break;

      case 'remove_from_list':
        await this.executeRemoveFromList(config, contact);
        break;

      case 'assign_to_user':
        await this.executeAssignToUser(config, contact);
        break;

      case 'move_to_pipeline':
        await this.executeMoveToPipeline(config, contact);
        break;

      default:
        console.log(`[JourneyExecution] Tipo de ação não implementado: ${actionType}`);
    }
  }

  private async getLatestConversationForContact(contactId: string) {
    return prisma.conversation.findFirst({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        channelId: true,
        contactId: true,
        assignedToId: true,
      },
    });
  }

  private async executeAddTag(config: any, contact: any): Promise<void> {
    const tagName = String(config.tagName || '').trim();
    if (!tagName) {
      console.warn('[JourneyExecution] add_tag ignorado: tagName não configurada');
      return;
    }

    const conversation = await this.getLatestConversationForContact(contact.id);
    if (!conversation) {
      console.warn(`[JourneyExecution] add_tag ignorado: contato ${contact.id} sem conversa`);
      return;
    }

    const existingTag = await prisma.tag.findFirst({
      where: { name: { equals: tagName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    const tag =
      existingTag ||
      (await prisma.tag.create({
        data: { name: tagName },
        select: { id: true, name: true },
      }));

    await prisma.conversationTag.upsert({
      where: {
        conversationId_tagId: {
          conversationId: conversation.id,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        conversationId: conversation.id,
        tagId: tag.id,
      },
    });

    await this.processEvent('tag_added', {
      contactId: contact.id,
      channelId: conversation.channelId,
      conversationId: conversation.id,
      tagName: tag.name,
    });
  }

  private async executeRemoveTag(config: any, contact: any): Promise<void> {
    const tagName = String(config.tagName || '').trim();
    if (!tagName) {
      console.warn('[JourneyExecution] remove_tag ignorado: tagName não configurada');
      return;
    }

    const conversation = await this.getLatestConversationForContact(contact.id);
    if (!conversation) {
      console.warn(`[JourneyExecution] remove_tag ignorado: contato ${contact.id} sem conversa`);
      return;
    }

    const tag = await prisma.tag.findFirst({
      where: { name: { equals: tagName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!tag) return;

    await prisma.conversationTag.deleteMany({
      where: {
        conversationId: conversation.id,
        tagId: tag.id,
      },
    });
  }

  private async executeUpdateField(config: any, contact: any): Promise<void> {
    const fieldName = String(config.fieldName || '').trim();
    if (!fieldName) {
      console.warn('[JourneyExecution] update_field ignorado: fieldName não configurado');
      return;
    }

    const fallbackValue = config.value !== undefined ? config.value : config.fieldValue;
    const fieldValue = fallbackValue === undefined || fallbackValue === null ? '' : String(fallbackValue);

    if (fieldName === 'name' || fieldName === 'phone' || fieldName === 'email') {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { [fieldName]: fieldValue || null },
      });
      return;
    }

    const currentContact = await prisma.contact.findUnique({
      where: { id: contact.id },
      select: { metadata: true },
    });
    const metadata =
      currentContact?.metadata && typeof currentContact.metadata === 'object'
        ? { ...(currentContact.metadata as Record<string, any>) }
        : {};
    metadata[fieldName] = fieldValue;

    await prisma.contact.update({
      where: { id: contact.id },
      data: { metadata },
    });
  }

  private async executeAddToList(config: any, contact: any): Promise<void> {
    const listId = String(config.listId || '').trim();
    if (!listId) {
      console.warn('[JourneyExecution] add_to_list ignorado: listId não configurado');
      return;
    }

    await prisma.contactListMember.upsert({
      where: {
        listId_contactId: {
          listId,
          contactId: contact.id,
        },
      },
      update: {},
      create: {
        listId,
        contactId: contact.id,
      },
    });

    await this.processEvent('list_added', {
      contactId: contact.id,
      channelId: contact.channelId || null,
      listId,
    });
  }

  private async executeRemoveFromList(config: any, contact: any): Promise<void> {
    const listId = String(config.listId || '').trim();
    if (!listId) {
      console.warn('[JourneyExecution] remove_from_list ignorado: listId não configurado');
      return;
    }

    await prisma.contactListMember.deleteMany({
      where: {
        listId,
        contactId: contact.id,
      },
    });
  }

  private async executeAssignToUser(config: any, contact: any): Promise<void> {
    const userId = String(config.userId || config.assignedToId || '').trim();
    if (!userId) {
      console.warn('[JourneyExecution] assign_to_user ignorado: userId não configurado');
      return;
    }

    const conversation = await this.getLatestConversationForContact(contact.id);
    if (!conversation) {
      console.warn(`[JourneyExecution] assign_to_user ignorado: contato ${contact.id} sem conversa`);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      console.warn(`[JourneyExecution] assign_to_user ignorado: usuário ${userId} inválido/inativo`);
      return;
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedToId: user.id },
    });
  }

  private async executeMoveToPipeline(config: any, contact: any): Promise<void> {
    const pipelineId = String(config.pipelineId || '').trim();
    const explicitStageId = String(config.stageId || '').trim();
    if (!pipelineId && !explicitStageId) {
      console.warn('[JourneyExecution] move_to_pipeline ignorado: pipelineId/stageId não configurados');
      return;
    }

    const currentDeal = await prisma.deal.findFirst({
      where: { contactId: contact.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        pipelineId: true,
        stageId: true,
        assignedToId: true,
        contactId: true,
        conversationId: true,
        name: true,
        value: true,
        currency: true,
        probability: true,
      },
    });

    let targetStageId = explicitStageId;
    let targetPipelineId = pipelineId;

    if (explicitStageId) {
      const stage = await prisma.pipelineStage.findUnique({
        where: { id: explicitStageId },
        select: { id: true, pipelineId: true, isActive: true },
      });
      if (!stage || !stage.isActive) {
        console.warn(`[JourneyExecution] move_to_pipeline ignorado: stage inválida ${explicitStageId}`);
        return;
      }
      targetStageId = stage.id;
      targetPipelineId = stage.pipelineId;
    } else {
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { pipelineId: targetPipelineId, isActive: true },
        orderBy: { order: 'asc' },
        select: { id: true, pipelineId: true },
      });
      if (!firstStage) {
        console.warn(`[JourneyExecution] move_to_pipeline ignorado: pipeline ${targetPipelineId} sem etapa ativa`);
        return;
      }
      targetStageId = firstStage.id;
      targetPipelineId = firstStage.pipelineId;
    }

    if (currentDeal) {
      await prisma.deal.update({
        where: { id: currentDeal.id },
        data: {
          pipelineId: targetPipelineId,
          stageId: targetStageId,
        },
      });
      return;
    }

    const conversation = await this.getLatestConversationForContact(contact.id);
    await prisma.deal.create({
      data: {
        contactId: contact.id,
        conversationId: conversation?.id || null,
        pipelineId: targetPipelineId,
        stageId: targetStageId,
        assignedToId: conversation?.assignedToId || null,
        name: String(contact.name || '').trim() || 'Lead sem nome',
        value: null,
        currency: 'BRL',
        probability: 0,
      },
    });
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
  private async evaluateCondition(node: any, contact: any, context: Record<string, any>): Promise<boolean> {
    const config = this.parseNodeConfig(node.config || {});
    const conditionType = config.conditionType;
    const operator = config.operator || 'equals';
    const rawValue = config.value ?? config.fieldValue ?? '';

    const compare = (left: any, right: any): boolean => {
      const l = left === undefined || left === null ? '' : String(left).toLowerCase();
      const r = right === undefined || right === null ? '' : String(right).toLowerCase();
      switch (operator) {
        case 'equals':
          return l === r;
        case 'not_equals':
          return l !== r;
        case 'contains':
          return l.includes(r);
        case 'not_contains':
          return !l.includes(r);
        default:
          return l === r;
      }
    };

    switch (conditionType) {
      case 'has_tag': {
        const tagName = String(config.tagName || rawValue || '').trim();
        if (!tagName) return false;
        const conversation = await this.getLatestConversationForContact(contact.id);
        if (!conversation) return false;
        const tag = await prisma.tag.findFirst({
          where: { name: { equals: tagName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (!tag) return false;
        const relation = await prisma.conversationTag.findUnique({
          where: {
            conversationId_tagId: {
              conversationId: conversation.id,
              tagId: tag.id,
            },
          },
          select: { tagId: true },
        });
        return !!relation;
      }
      case 'has_field':
      case 'field_equals':
      case 'field_contains': {
        const fieldName = String(config.fieldName || '').trim();
        if (!fieldName) return false;
        const metadata = contact.metadata && typeof contact.metadata === 'object' ? contact.metadata : {};
        const left =
          fieldName === 'name' || fieldName === 'phone' || fieldName === 'email'
            ? (contact as any)[fieldName]
            : (metadata as any)[fieldName];
        const effectiveOperator =
          conditionType === 'field_contains' ? 'contains' : conditionType === 'field_equals' ? 'equals' : operator;
        const prev = operator;
        (config as any).__tmpOperator = effectiveOperator;
        const res = (() => {
          const l = left === undefined || left === null ? '' : String(left).toLowerCase();
          const r = rawValue === undefined || rawValue === null ? '' : String(rawValue).toLowerCase();
          switch (effectiveOperator) {
            case 'equals':
              return l === r;
            case 'not_equals':
              return l !== r;
            case 'contains':
              return l.includes(r);
            case 'not_contains':
              return !l.includes(r);
            default:
              return compare(left, rawValue);
          }
        })();
        (config as any).__tmpOperator = prev;
        return res;
      }
      case 'message_received': {
        const eventType = String(context.eventType || '').trim();
        if (eventType !== 'message_received') return false;
        const expected = String(config.value || config.messageText || '').trim();
        if (!expected) return true;
        const incomingContent = String(context.messageContent || '').trim();
        return incomingContent.toLowerCase().includes(expected.toLowerCase());
      }
      case 'in_list': {
        const listId = String(config.listId || '').trim();
        if (!listId) return false;
        const member = await prisma.contactListMember.findUnique({
          where: {
            listId_contactId: {
              listId,
              contactId: contact.id,
            },
          },
          select: { id: true },
        });
        return !!member;
      }
      case 'date_time': {
        const comparison = String(config.dateComparison || 'before');
        const now = new Date();
        if (comparison === 'between') {
          const start = config.dateStartValue || config.dateValue;
          const end = config.dateEndValue;
          if (!start || !end) return false;
          const startDate = new Date(start);
          const endDate = new Date(end);
          return now >= startDate && now <= endDate;
        }
        const dateValue = config.dateValue;
        if (!dateValue) return false;
        const target = new Date(dateValue);
        if (Number.isNaN(target.getTime())) return false;
        if (comparison === 'after') return now > target;
        return now < target;
      }
      case 'in_pipeline': {
        const pipelineId = String(config.pipelineId || '').trim();
        const stageId = String(config.stageId || '').trim();
        const deal = await prisma.deal.findFirst({
          where: { contactId: contact.id, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          select: { pipelineId: true, stageId: true },
        });
        if (!deal) return false;
        if (pipelineId && deal.pipelineId !== pipelineId) return false;
        if (stageId && deal.stageId !== stageId) return false;
        return true;
      }
      case 'if_then': {
        const source = String(config.fieldName || config.leftValue || '').trim();
        if (!source) return false;
        const metadata = contact.metadata && typeof contact.metadata === 'object' ? contact.metadata : {};
        const left =
          source === 'name' || source === 'phone' || source === 'email'
            ? (contact as any)[source]
            : source.startsWith('context.')
            ? context[source.replace(/^context\./, '')]
            : (metadata as any)[source];
        return compare(left, rawValue);
      }
      default:
        return false;
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
    const config = this.parseNodeConfig(triggerNode.config);
    const triggerType = config.triggerType;

    switch (triggerType) {
      case 'new_contact':
        return eventType === 'contact_created';
      
      case 'new_conversation':
        return eventType === 'conversation_created';
      
      case 'message_received':
        return eventType === 'message_received';
      
      case 'tag_added':
        if (eventType !== 'tag_added') return false;
        if (!config.tagName) return true;
        return String(eventData?.tagName || '').trim().toLowerCase() === String(config.tagName).trim().toLowerCase();
      
      case 'list_added':
        if (eventType !== 'list_added') return false;
        if (!config.listId) return true;
        return eventData?.listId === config.listId;
      
      case 'manual':
        return false; // Manual precisa ser acionado via API
      
      default:
        return false;
    }
  }
}

