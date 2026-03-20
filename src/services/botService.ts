import prisma from '../config/database';
import { MessageService } from './messageService';
import { BotVariableService } from './botVariableService';
import vm from 'vm';

export interface CreateBotData {
  name: string;
  description?: string;
  avatar?: string;
  channelId: string;
  sectorId?: string | null;
  language?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
   // Configuração de encerramento automático por inatividade
  autoCloseEnabled?: boolean;
  autoCloseAfterMinutes?: number;
  autoCloseMessage?: string;
}

export interface CreateIntentData {
  botId: string;
  name: string;
  keywords: string[];
  patterns?: string[];
  priority?: number;
}

export interface CreateResponseData {
  intentId?: string;
  flowStepId?: string;
  type: string;
  content: string;
  buttons?: any;
  mediaUrl?: string;
  metadata?: any;
  order?: number;
}

export interface CreateFlowData {
  botId: string;
  name: string;
  description?: string;
  trigger: string;
  triggerValue?: string;
}

export class BotService {
  private messageService: MessageService;
  private variableService: BotVariableService;

  constructor() {
    this.messageService = new MessageService();
    this.variableService = new BotVariableService();
  }

  /**
   * Parse variáveis em uma string, substituindo {{variavel}} pelo valor do contexto
   * Suporta métodos JavaScript simples: {{variavel.toUpperCase}}, {{variavel.toLowerCase}}, {{variavel.toFixed}}
   */
  parseVariables(content: string, context: Record<string, any>): string {
    if (!content || typeof content !== 'string') {
      return content;
    }

    // Regex para encontrar {{variavel}} ou {{variavel.metodo}}
    return content.replace(/\{\{(\w+)(?:\.(\w+)(?:\((\d+)\))?)?\}\}/g, (match, varName, method, methodParam) => {
      const value = context[varName];
      
      if (value === undefined || value === null) {
        // Se variável não existe, retornar o placeholder original
        return match;
      }

      // Aplicar método se especificado
      if (method) {
        if (method === 'toUpperCase') {
          return String(value).toUpperCase();
        }
        if (method === 'toLowerCase') {
          return String(value).toLowerCase();
        }
        if (method === 'toFixed' && typeof value === 'number') {
          const decimals = methodParam ? parseInt(methodParam) : 2;
          return value.toFixed(decimals);
        }
        if (method === 'substring') {
          const length = methodParam ? parseInt(methodParam) : 50;
          const str = String(value);
          return str.length > length ? str.substring(0, length) + '...' : str;
        }
      }

      return String(value);
    });
  }

  /**
   * Cria um novo bot
   */
  async createBot(data: CreateBotData) {
    if (data.sectorId) {
      const channel = await prisma.channel.findUnique({
        where: { id: data.channelId },
        select: {
          sectorId: true,
          secondarySectors: {
            select: { sectorId: true },
          },
        },
      });

      if (!channel) {
        throw new Error('Canal não encontrado para validar setor do bot');
      }

      const allowed =
        channel.sectorId === data.sectorId ||
        (channel.secondarySectors || []).some((s) => s.sectorId === data.sectorId);

      if (!allowed) {
        throw new Error('Este setor não pertence ao canal configurado');
      }
    }

    const bot = await prisma.bot.create({
      data: {
        name: data.name,
        description: data.description,
        avatar: data.avatar,
        channelId: data.channelId,
        sectorId: data.sectorId ?? null,
        language: data.language || 'pt-BR',
        welcomeMessage: data.welcomeMessage,
        fallbackMessage: data.fallbackMessage || 'Desculpe, não entendi. Pode reformular sua pergunta?',
        isActive: true,
        autoCloseEnabled: data.autoCloseEnabled ?? false,
        autoCloseAfterMinutes: data.autoCloseAfterMinutes ?? null,
        autoCloseMessage: data.autoCloseMessage ?? null,
      },
    });

    console.log('[BotService] Bot criado:', bot.id);

    // Garantir regra: 1 bot => 1 fluxo (cria o fluxo principal automaticamente)
    await prisma.flow.create({
      data: {
        botId: bot.id,
        name: 'Fluxo principal',
        description: 'Fluxo padrão do bot',
        trigger: 'always',
        triggerValue: null,
        isActive: true,
      },
    });

    return bot;
  }

  /**
   * Lista bots
   */
  async listBots(channelId?: string, isActive?: boolean) {
    const where: any = {};

    if (channelId) {
      where.channelId = channelId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const bots = await prisma.bot.findMany({
      where,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            intents: true,
            flows: true,
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bots;
  }

  /**
   * Obtém um bot por ID
   */
  async getBotById(botId: string) {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        channel: true,
        intents: {
          include: {
            responses: true,
          },
        },
        flows: {
          include: {
            steps: {
              include: {
                response: true,
                conditions: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    return bot;
  }

  /**
   * Processa uma mensagem recebida e verifica se há bot ativo
   * @param messageContent Conteúdo textual normalizado da mensagem
   * @param conversationId ID da conversa
   * @param inputMeta Metadados da entrada (ex: tipo da mensagem, url de mídia, etc.)
   */
  async processMessage(
    messageContent: string,
    conversationId: string,
    inputMeta?: { messageType?: string; [key: string]: any },
  ) {
    // Buscar conversa com canal
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        channel: true,
        botSession: true, // Não incluir bot aqui, vamos buscar separadamente
      },
    });

    if (!conversation) {
      return null;
    }

    // Só processar mensagens se já existir uma sessão de bot ativa para esta conversa.
    // Isso garante que o bot só atua quando foi explicitamente iniciado por uma automação (ex: Robô de vendas no pipeline).
    if (!conversation.botSession || !conversation.botSession.isActive) {
      console.log('[BotService] Nenhuma sessão de bot ativa para esta conversa, ignorando mensagem');
      return null;
    }

    // Carregar o bot associado à sessão
    const session: any = conversation.botSession as any;

    if (!session.botId) {
      console.warn('[BotService] Sessão de bot sem botId associado, ignorando');
      return null;
    }

    // Condicionar o bot ao "escopo" da automação.
    // Se a sessão foi iniciada via pipeline (coluna/stage), só responder enquanto o deal da conversa estiver na mesma stage.
    const sessionContext = (session.context as any) || {};
    if (sessionContext?.mode === 'pipeline' || sessionContext?.pipelineId || sessionContext?.stageId) {
      const deal = await prisma.deal.findUnique({
        where: { conversationId },
        select: {
          pipelineId: true,
          stageId: true,
        },
      });

      // Se a conversa não está mais em um deal/pipeline, desativar o bot.
      if (!deal) {
        await prisma.botSession.update({
          where: { conversationId },
          data: { isActive: false },
        });
        return null;
      }

      const expectedPipelineId = sessionContext.pipelineId;
      const expectedStageId = sessionContext.stageId;

      const pipelineMismatch =
        expectedPipelineId && deal.pipelineId !== expectedPipelineId;
      const stageMismatch = expectedStageId && deal.stageId !== expectedStageId;

      if (pipelineMismatch || stageMismatch) {
        await prisma.botSession.update({
          where: { conversationId },
          data: { isActive: false },
        });
        return null;
      }
    }

    // Fora do pipeline: condicionar o bot ao setor da conversa.
    // Ex: canal A (setor principal) -> bot principal; ao transferir para setor secundário -> bot secundário.
    if (sessionContext?.mode === 'outside') {
      const expectedSectorId = sessionContext.sectorId || null;
      const currentSectorId = conversation.sectorId || (conversation.channel as any)?.sectorId || null;

      if (expectedSectorId && currentSectorId && expectedSectorId !== currentSectorId) {
        await prisma.botSession.update({
          where: { conversationId },
          data: { isActive: false },
        });
        return null;
      }

      // Se o bot está configurado para um setor mas a conversa não tem setor definido, desativar.
      if (expectedSectorId && !currentSectorId) {
        await prisma.botSession.update({
          where: { conversationId },
          data: { isActive: false },
        });
        return null;
      }
    }

    const bot = await prisma.bot.findUnique({
      where: {
        id: session.botId,
      },
      include: {
        intents: {
          include: {
            responses: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        flows: {
          include: {
            steps: {
              include: {
                response: true,
                conditions: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!bot || !bot.isActive) {
      console.log('[BotService] Bot da sessão não encontrado ou inativo, ignorando mensagem');
      return null;
    }

    // Tentar fazer match de intent (apenas para mensagens de texto)
    const matchedIntent =
      !inputMeta?.messageType || inputMeta.messageType === 'text'
        ? await this.matchIntent(messageContent, bot.id)
        : null;

    if (matchedIntent) {
      // Enviar resposta do intent
      const response = matchedIntent.responses[0]; // Pegar primeira resposta
      if (response) {
        const sessionContext = (session?.context as Record<string, any>) || {};
        await this.sendBotResponse(conversation.id, response, bot.id, sessionContext);
        return { intent: matchedIntent, response };
      }
    }

    // Se não encontrou intent, verificar se há fluxo ativo
    if (session && (session as any).currentFlowId) {
      const flow = (bot as any).flows?.find((f: any) => f.id === (session as any).currentFlowId);
      if (flow && session) {
        await this.executeFlow(flow, session as any, messageContent, inputMeta);
        return { flow: flow.id };
      }
    }

    // Se não há fluxo ativo, verificar se há fluxo com trigger "always" para iniciar automaticamente
    if (session && !(session as any).currentFlowId) {
      // Buscar fluxo com trigger "always" (ou sem trigger) e priorizar o que tenha steps.
      // Isso evita cair em fluxos legados vazios quando existem múltiplos fluxos antigos.
      const candidateFlows = ((bot as any).flows || []).filter(
        (f: any) => f.isActive && (f.trigger === 'always' || !f.trigger || f.trigger === ''),
      );
      const alwaysFlow = candidateFlows.sort((a: any, b: any) => {
        const aStepCount = Array.isArray(a.steps) ? a.steps.length : 0;
        const bStepCount = Array.isArray(b.steps) ? b.steps.length : 0;
        if (aStepCount !== bStepCount) return bStepCount - aStepCount;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      })[0];
      
      if (alwaysFlow) {
        console.log(`[BotService] Iniciando fluxo automático "${alwaysFlow.name}" (trigger: ${alwaysFlow.trigger || 'always'})`);
        // Usar o step de ENTRADA do fluxo (conectado ao Início no builder)
        const entryStep = this.getFlowEntryStep(alwaysFlow);
        const firstStep = entryStep?.type === 'MESSAGE'
          ? entryStep
          : [...(alwaysFlow.steps || [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).find((s: any) => s.type === 'MESSAGE') || entryStep;
        
        if (firstStep) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: alwaysFlow.id,
              currentStepId: firstStep.id,
            },
          });

          // Executar o primeiro step do fluxo automaticamente (sem esperar input do usuário)
          const updatedSession = {
            ...session,
            currentFlowId: alwaysFlow.id,
            currentStepId: firstStep.id,
          };
          
          // Executar o primeiro step imediatamente
          await this.executeFlow(
            alwaysFlow,
            updatedSession as any,
            '',
            { ...(inputMeta || {}), _fromFlow: true } as any,
          );
          return { flow: alwaysFlow.id, autoStarted: true };
        } else {
          console.warn(`[BotService] Fluxo "${alwaysFlow.name}" não tem steps configurados`);
        }
      } else {
        const flows = (bot as any).flows || [];
        console.log(`[BotService] Nenhum fluxo "always" encontrado. Fluxos disponíveis:`, flows.map((f: any) => ({ name: f.name, trigger: f.trigger, isActive: f.isActive })));
      }
    }

    // Se não encontrou nada, enviar mensagem de fallback
    if (bot.fallbackMessage) {
      const sessionContext = (session?.context as Record<string, any>) || {};
      await this.sendBotResponse(conversation.id, {
        type: 'TEXT',
        content: bot.fallbackMessage,
      } as any, bot.id, sessionContext);
    }

    return { fallback: true };
  }

  /**
   * Faz match de uma mensagem com as intents do bot
   */
  async matchIntent(message: string, botId: string) {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        intents: {
          include: {
            responses: true,
          },
          orderBy: {
            priority: 'desc', // Prioridade maior primeiro
          },
        },
      },
    });

    if (!bot) {
      return null;
    }

    const normalizedMessage = message.toLowerCase().trim();

    // Verificar keywords
    for (const intent of bot.intents) {
      // Verificar keywords
      for (const keyword of intent.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
          console.log(`[BotService] Intent "${intent.name}" encontrado por keyword: "${keyword}"`);
          return intent;
        }
      }

      // Verificar patterns (regex)
      for (const pattern of intent.patterns || []) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(normalizedMessage)) {
            console.log(`[BotService] Intent "${intent.name}" encontrado por pattern: "${pattern}"`);
            return intent;
          }
        } catch (error) {
          console.error(`[BotService] Erro ao processar pattern "${pattern}":`, error);
        }
      }
    }

    return null;
  }

  /**
   * Verifica se o texto é uma saudação ou pedido de reinício (reiniciar fluxo do começo)
   */
  private isGreetingOrRestart(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim().toLowerCase();
    const greetings = [
      'olá', 'ola', 'oi', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite',
      'menu', 'início', 'inicio', 'começar', 'comecar', 'start', 'reiniciar', 'voltar',
    ];
    return greetings.some((g) => t === g || t.startsWith(g + ' ') || t === g + '!');
  }

  /**
   * Retorna o step de entrada do fluxo (o que nenhum outro step aponta = conectado ao Início no builder).
   * Assim respeitamos a ordem visual do fluxo, não apenas o campo "order" do banco.
   */
  private getFlowEntryStep(flow: any): any {
    const steps = flow.steps || [];
    if (steps.length === 0) return null;

    // Construir conjunto de IDs que são alvo de alguma conexão:
    // - nextStepId de qualquer step
    // - trueStepId / falseStepId das condições
    const referencedIds = new Set<string>();
    for (const s of steps) {
      if (s.nextStepId && s.nextStepId !== 'END') {
        referencedIds.add(s.nextStepId);
      }
      if (Array.isArray(s.conditions)) {
        for (const c of s.conditions) {
          if (c.trueStepId && c.trueStepId !== 'END') {
            referencedIds.add(c.trueStepId);
          }
          if (c.falseStepId && c.falseStepId !== 'END') {
            referencedIds.add(c.falseStepId);
          }
        }
      }
    }

    // Entrada = step que não é alvo de nenhuma conexão
    const entryStep = steps.find((step: any) => !referencedIds.has(step.id));
    if (entryStep) return entryStep;
    // Fallback: menor order (comportamento antigo)
    const ordered = [...steps].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    return ordered[0];
  }

  /**
   * Executa um fluxo
   */
  async executeFlow(
    flow: any,
    session: any,
    input: string,
    inputMeta?: { messageType?: string; [key: string]: any },
  ) {
    console.log(`[BotService] Executando fluxo "${flow.name}", step atual: ${session.currentStepId || 'nenhum'}`);
    
    // Implementação básica - pode ser expandida
    const currentStep = flow.steps.find((s: any) => s.id === session.currentStepId) || flow.steps[0];

    if (!currentStep) {
      console.warn(`[BotService] Nenhum step encontrado no fluxo "${flow.name}"`);
      return;
    }

    // Se estamos em um step que espera input do usuário (INPUT, etc.) e ele mandou
    // uma saudação/pedido de reinício (ex: "oi", "menu"), reiniciar o fluxo no
    // step de ENTRADA real (conectado ao Início no builder) para respeitar o desenho.
    const messageType = inputMeta?.messageType;
    const isTextMessage = !messageType || messageType === 'text';
    const inputSteps = ['PICTURE_CHOICE', 'INPUT', 'TEXT_INPUT', 'EMAIL_INPUT', 'NUMBER_INPUT', 'PHONE_INPUT'];
    if (
      inputSteps.includes(currentStep.type) &&
      isTextMessage &&
      this.isGreetingOrRestart(input)
    ) {
      const entryStep = this.getFlowEntryStep(flow);
      if (entryStep && entryStep.id !== currentStep.id) {
        console.log(
          `[BotService] Saudação/reinício detectado ("${input?.substring(
            0,
            30,
          )}"), reiniciando no step de entrada (tipo: ${entryStep.type})`,
        );
        await prisma.botSession.update({
          where: { id: session.id },
          data: { currentStepId: entryStep.id },
        });
        const updatedSession = { ...session, currentStepId: entryStep.id };
        await this.executeFlow(
          flow,
          updatedSession,
          '',
          { ...(inputMeta || {}), _fromFlow: true } as any,
        );
        return;
      }
    }

    console.log(`[BotService] Processando step tipo: ${currentStep.type}, order: ${currentStep.order}`);

    // Processar step baseado no tipo
    switch (currentStep.type) {
      case 'MESSAGE':
        if (currentStep.response) {
          console.log(`[BotService] Enviando mensagem do step:`, currentStep.response.content?.substring(0, 50));
          const sessionContext = (session.context as Record<string, any>) || {};
          await this.sendBotResponse(session.conversationId, currentStep.response, session.botId, sessionContext);
        } else {
          console.warn(`[BotService] Step MESSAGE sem resposta configurada`);
        }
        // Avançar para próximo step automaticamente se houver.
        // 1) Preferir nextStepId explícito (via conexões do builder).
        // 2) Se não existir, usar fallback pelo campo "order" (próximo step na sequência).
        let nextStepId: string | null | undefined = currentStep.nextStepId;
        const autoAdvanceAllowed =
          !inputMeta?.['_fromWait'] && !inputMeta?.['_fromJump'];

        if (!nextStepId && autoAdvanceAllowed) {
          const orderedSteps = [...flow.steps].sort(
            (a: any, b: any) => (a.order || 0) - (b.order || 0),
          );
          const currentIndex = orderedSteps.findIndex((s: any) => s.id === currentStep.id);
          if (currentIndex >= 0 && currentIndex + 1 < orderedSteps.length) {
            nextStepId = orderedSteps[currentIndex + 1].id;
            console.log(
              `[BotService] nextStepId não definido; usando fallback pelo order -> próximo step ${nextStepId}`,
            );
          }
        }

        if (!nextStepId) {
          // Se não há próximo step, finalizar fluxo
          console.log(
            `[BotService] Fluxo "${flow.name}" finalizado (sem nextStepId e sem fallback pelo order)`,
          );
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
          break;
        }

        // Se nextStepId é "END", finalizar fluxo
        if (nextStepId === 'END') {
          console.log(`[BotService] Fluxo "${flow.name}" finalizado (step END)`);
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
        } else {
          // Atualizar sessão com próximo step
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentStepId: nextStepId,
            },
          });

        // Executar próximo step automaticamente se for MESSAGE
        // Se for INPUT/PICTURE_CHOICE, apenas atualizar o currentStepId e aguardar resposta do usuário
          const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
          if (nextStep) {
            if (nextStep.type === 'MESSAGE') {
              // Executar próximo step MESSAGE automaticamente
              const updatedSession = {
                ...session,
                currentStepId: nextStepId,
              };
              await this.executeFlow(
                flow,
                updatedSession,
                input,
                { ...(inputMeta || {}), _fromFlow: true } as any,
              );
            } else if (
              nextStep.type === 'INPUT' ||
              nextStep.type === 'TEXT_INPUT' ||
              nextStep.type === 'EMAIL_INPUT' ||
              nextStep.type === 'NUMBER_INPUT' ||
              nextStep.type === 'PHONE_INPUT' ||
              nextStep.type === 'PICTURE_CHOICE'
            ) {
              // Para steps INPUT/PICTURE_CHOICE, apenas atualizar o currentStepId e aguardar resposta do usuário
              // Não executar automaticamente - o próximo processMessage vai processar o INPUT
              console.log(
                `[BotService] Aguardando input/imagem do usuário no step ${nextStep.id} (tipo: ${nextStep.type})`,
              );
            } else {
              // Para outros tipos, executar automaticamente
              const updatedSession = {
                ...session,
                currentStepId: nextStepId,
              };
              await this.executeFlow(
                flow,
                updatedSession,
                input,
                { ...(inputMeta || {}), _fromFlow: true } as any,
              );
            }
          }
        }
        break;

      case 'HANDOFF': {
        const mode = (currentStep.config?.mode || 'single').toUpperCase();

        // Modo padrão: handoff para um usuário específico
        if (mode !== 'ROUND_ROBIN') {
          await this.handoffToHuman(session.id, currentStep.config?.userId);
          break;
        }

        const userIds: string[] = Array.isArray(currentStep.config?.userIds)
          ? currentStep.config.userIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
          : [];

        if (!userIds.length) {
          console.warn(
            `[BotService] Step HANDOFF em modo ROUND_ROBIN mas sem userIds configurados. Caindo para handoff simples.`,
          );
          await this.handoffToHuman(session.id, currentStep.config?.userId);
          break;
        }

        // Usar contexto da sessão para guardar o índice atual da fila
        const context = (session.context as any) || {};
        const rrKey = `roundRobin_${currentStep.id}`;
        const currentIndex = Number(context[rrKey]?.index || 0);
        const nextUserId = userIds[currentIndex % userIds.length];
        const nextIndex = (currentIndex + 1) % userIds.length;

        // Atualizar contexto com próximo índice
        context[rrKey] = { index: nextIndex, updatedAt: new Date().toISOString() };
        await prisma.botSession.update({
          where: { id: session.id },
          data: {
            context,
          },
        });

        await this.handoffToHuman(session.id, nextUserId);
        break;
      }

      case 'MOVE_DEAL': {
        const targetPipelineId = currentStep.config?.pipelineId as string | undefined;
        const targetStageId = currentStep.config?.stageId as string | undefined;

        if (!targetPipelineId && !targetStageId) {
          console.warn('[BotService] MOVE_DEAL sem pipelineId ou stageId configurados');
          break;
        }

        // Buscar negócio ligado a esta conversa
        const deal = await prisma.deal.findFirst({
          where: { conversationId: session.conversationId },
        });

        if (!deal) {
          console.warn(
            `[BotService] MOVE_DEAL: nenhum negócio encontrado para conversationId=${session.conversationId}`,
          );
          break;
        }

        let finalStageId = targetStageId || null;
        let finalPipelineId = targetPipelineId || deal.pipelineId;

        if (targetStageId) {
          const stage = await prisma.pipelineStage.findUnique({
            where: { id: targetStageId },
          });
          if (!stage) {
            console.warn(`[BotService] MOVE_DEAL: etapa destino não encontrada (${targetStageId})`);
            break;
          }
          finalStageId = stage.id;
          finalPipelineId = stage.pipelineId;
        } else if (targetPipelineId && !targetStageId) {
          // Se só o funil foi escolhido, usar a primeira etapa ativa desse funil
          const firstStage = await prisma.pipelineStage.findFirst({
            where: { pipelineId: targetPipelineId, isActive: true },
            orderBy: { order: 'asc' },
          });
          if (!firstStage) {
            console.warn(
              `[BotService] MOVE_DEAL: nenhum stage ativo encontrado para pipeline ${targetPipelineId}`,
            );
            break;
          }
          finalStageId = firstStage.id;
          finalPipelineId = firstStage.pipelineId;
        }

        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            pipelineId: finalPipelineId || deal.pipelineId,
            stageId: finalStageId || deal.stageId,
          },
        });

        console.log(
          `[BotService] MOVE_DEAL: negócio ${deal.id} movido para pipeline=${finalPipelineId} stage=${finalStageId}`,
        );
        break;
      }

      case 'CONDITION': {
        // Múltiplas condições: avaliar todas e combinar com AND ou OR (config.logicOperator)
        const conditionsList = (currentStep.conditions || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        const logicOperator = (currentStep.config?.logicOperator || 'AND').toUpperCase();
        let result = false;

        if (conditionsList.length === 0) {
          console.warn(`[BotService] Step CONDITION sem condições definidas`);
          break;
        }

        const resultList = conditionsList.map((c: any) =>
          this.evaluateCondition(c, input, session.context || {})
        );

        if (logicOperator === 'OR') {
          result = resultList.some(Boolean);
        } else {
          result = resultList.every(Boolean);
        }

        // trueStepId e falseStepId vêm da primeira condição (todas apontam para os mesmos ramos no fluxo)
        const firstCondition = conditionsList[0];
        const nextStepId = result ? firstCondition.trueStepId : firstCondition.falseStepId;

        if (nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: nextStepId },
          });

          // Executar automaticamente o próximo step se for MESSAGE ou CONDITION
          if (nextStepId !== 'END') {
            const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
            if (nextStep && (nextStep.type === 'MESSAGE' || nextStep.type === 'CONDITION')) {
              const updatedSession = {
                ...session,
                currentStepId: nextStepId,
              };
              await this.executeFlow(
                flow,
                updatedSession as any,
                input,
                { ...(inputMeta || {}), _fromFlow: true } as any,
              );
            }
          }
        }
        break;
      }

      case 'DELAY':
        // Aguardar tempo especificado
        const delay = currentStep.config?.delay || 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentStepId: currentStep.nextStepId,
            },
          });
        }
        break;

      case 'INPUT':
      case 'TEXT_INPUT':
        // Processar input do usuário e validar
        console.log(`[BotService] Processando INPUT step ${currentStep.id} com input: "${input}"`);
        const isValid = await this.validateInput(currentStep, input);
        const sessionContext = (session.context as Record<string, any>) || {};
        
        if (isValid) {
          // Salvar resposta em variável se especificado
          const variableName = currentStep.config?.variableName;
          let updatedContext = sessionContext;
          if (variableName) {
            updatedContext = this.variableService.setVariableValue(sessionContext, variableName, input);
            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                context: updatedContext,
              },
            });
            console.log(`[BotService] Variável "${variableName}" salva com valor: "${input}"`);
          }
          
          // Avançar para próximo step
          if (currentStep.nextStepId) {
            if (currentStep.nextStepId === 'END') {
              // Finalizar fluxo
              console.log(`[BotService] Fluxo "${flow.name}" finalizado após INPUT`);
              await prisma.botSession.update({
                where: { id: session.id },
                data: {
                  currentFlowId: null,
                  currentStepId: null,
                },
              });
            } else {
              // Atualizar para próximo step e executar automaticamente se for MESSAGE ou CONDITION
              await prisma.botSession.update({
                where: { id: session.id },
                data: {
                  currentStepId: currentStep.nextStepId,
                },
              });
              
              // Executar próximo step automaticamente se for MESSAGE, CONDITION ou SCRIPT
              const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
              if (
                nextStep &&
                (nextStep.type === 'MESSAGE' ||
                 nextStep.type === 'CONDITION' ||
                 nextStep.type === 'SCRIPT')
              ) {
                const updatedSession = {
                  ...session,
                  currentStepId: currentStep.nextStepId,
                  context: updatedContext,
                };
                await this.executeFlow(
                  flow,
                  updatedSession,
                  input,
                  { ...(inputMeta || {}), _fromFlow: true } as any,
                );
              }
            }
          } else {
            // Se não há próximo step, finalizar fluxo
            console.log(`[BotService] Fluxo "${flow.name}" finalizado após INPUT (sem próximo step)`);
            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                currentFlowId: null,
                currentStepId: null,
              },
            });
          }
        } else {
          // Enviar mensagem de erro se houver
          const errorMessage = currentStep.config?.errorMessage || 'Resposta inválida. Por favor, tente novamente.';
          await this.sendBotResponse(session.conversationId, {
            type: 'TEXT',
            content: errorMessage,
          } as any, session.botId, sessionContext);
          // Não avança, aguarda nova tentativa
          console.log(`[BotService] Input inválido, aguardando nova tentativa`);
        }
        break;

      case 'SET_VARIABLE':
        // Definir valor de variável
        const varName = currentStep.config?.variableName;
        const varValue = currentStep.config?.value || input;
        
        if (varName) {
          const updatedContext = this.variableService.setVariableValue(
            (session.context as Record<string, any>) || {},
            varName,
            varValue
          );
          
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              context: updatedContext,
            },
          });
        }
        
        // Avançar para próximo step
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentStepId: currentStep.nextStepId,
            },
          });
        }
      case 'HTTP_REQUEST': {
        // Fazer chamada HTTP e salvar resultado em variável
        const httpConfig = currentStep.config;
        let updatedContext: Record<string, any> = { ...(session.context as Record<string, any>) || {} };

        if (httpConfig?.url) {
          try {
            const response = await this.executeHttpRequest(httpConfig, updatedContext);

            // Salvar resposta completa em variável se especificado
            if (httpConfig.variableName) {
              updatedContext = this.variableService.setVariableValue(
                updatedContext,
                httpConfig.variableName,
                response,
              );
            }

            // Mapear campos específicos para variáveis separadas
            if (httpConfig.fieldMappings && Array.isArray(httpConfig.fieldMappings)) {
              for (const mapping of httpConfig.fieldMappings) {
                if (mapping.fieldPath && mapping.variableName) {
                  const fieldValue = this.getNestedField(response, mapping.fieldPath);
                  if (fieldValue !== undefined) {
                    updatedContext = this.variableService.setVariableValue(
                      updatedContext,
                      mapping.variableName,
                      fieldValue,
                    );
                  }
                }
              }
            }

            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                context: updatedContext,
              },
            });

            // Atualizar contexto em memória
            (session as any).context = updatedContext;

            // Enviar mensagem com o resultado (opcional)
            if (httpConfig.showResponse) {
              const responseMessage =
                typeof response === 'object' ? JSON.stringify(response, null, 2) : String(response);
              await this.sendBotResponse(
                session.conversationId,
                {
                  type: 'TEXT',
                  content: `Resposta da API:\n${responseMessage}`,
                } as any,
                session.botId,
                updatedContext,
              );
            }
          } catch (error: any) {
            console.error('[BotService] Erro ao executar HTTP Request:', error);
            const errorMessage = httpConfig.errorMessage || `Erro ao chamar API: ${error.message}`;
            await this.sendBotResponse(
              session.conversationId,
              {
                type: 'TEXT',
                content: errorMessage,
              } as any,
              session.botId,
              (session.context as Record<string, any>) || {},
            );
          }
        }

        // Avançar para próximo step
        const nextStepId = currentStep.nextStepId;
        if (!nextStepId) {
          break;
        }

        if (nextStepId === 'END') {
          // Finalizar fluxo explicitamente
          console.log(`[BotService] Fluxo "${flow.name}" finalizado após HTTP_REQUEST (step END)`);
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
          break;
        }

        // Atualizar sessão com próximo step
        await prisma.botSession.update({
          where: { id: session.id },
          data: {
            currentStepId: nextStepId,
          },
        });

        // Executar automaticamente o próximo step se for MESSAGE, CONDITION ou SCRIPT
        const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
        if (nextStep && (nextStep.type === 'MESSAGE' || nextStep.type === 'CONDITION' || nextStep.type === 'SCRIPT')) {
          const updatedSession = {
            ...session,
            currentStepId: nextStepId,
            context: (session as any).context,
          };
          await this.executeFlow(
            flow,
            updatedSession as any,
            input,
            { ...(inputMeta || {}), _fromFlow: true } as any,
          );
        }
        break;
      }

      case 'IMAGE':
        // Enviar imagem
        const imageUrl = this.parseVariables(currentStep.config?.imageUrl || '', (session.context as Record<string, any>) || {});
        await this.sendBotResponse(session.conversationId, {
          type: 'IMAGE',
          content: currentStep.config?.altText || '',
          mediaUrl: imageUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'VIDEO':
        // Enviar vídeo
        const videoUrl = this.parseVariables(currentStep.config?.videoUrl || '', (session.context as Record<string, any>) || {});
        await this.sendBotResponse(session.conversationId, {
          type: 'VIDEO',
          content: '',
          mediaUrl: videoUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'AUDIO':
        // Enviar áudio
        const audioUrl = this.parseVariables(currentStep.config?.audioUrl || '', (session.context as Record<string, any>) || {});
        await this.sendBotResponse(session.conversationId, {
          type: 'AUDIO',
          content: '',
          mediaUrl: audioUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'EMBED':
        // Enviar embed (como mensagem de texto com URL)
        const embedUrl = this.parseVariables(currentStep.config?.embedUrl || '', (session.context as Record<string, any>) || {});
        await this.sendBotResponse(session.conversationId, {
          type: 'TEXT',
          content: `Embed: ${embedUrl}`,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'EMAIL_INPUT':
      case 'NUMBER_INPUT':
      case 'PHONE_INPUT':
      case 'DATE_INPUT':
      case 'FILE_UPLOAD':
        // Tratar como INPUT genérico com validação específica
        const inputType = currentStep.type.replace('_INPUT', '');
        const isValidInput = await this.validateInput({ ...currentStep, config: { ...currentStep.config, inputType } }, input);
        const inputContext = (session.context as Record<string, any>) || {};
        
        if (isValidInput) {
          const inputVariableName = currentStep.config?.variableName;
          if (inputVariableName) {
            const updatedInputContext = this.variableService.setVariableValue(inputContext, inputVariableName, input);
            await prisma.botSession.update({
              where: { id: session.id },
              data: { context: updatedInputContext },
            });
          }
          
          if (currentStep.nextStepId) {
            await prisma.botSession.update({
              where: { id: session.id },
              data: { currentStepId: currentStep.nextStepId },
            });
          }
        } else {
          const defaultErrorByType: Record<string, string> = {
            NUMBER_INPUT: 'Informe um numero valido',
            EMAIL_INPUT: 'Informe um e-mail válido.',
            PHONE_INPUT: 'Informe um telefone válido.',
            DATE_INPUT: 'Informe uma data válida.',
          };
          const errorMsg =
            currentStep.config?.errorMessage ||
            defaultErrorByType[currentStep.type] ||
            'Resposta inválida. Por favor, tente novamente.';
          await this.sendBotResponse(session.conversationId, {
            type: 'TEXT',
            content: errorMsg,
          } as any, session.botId, inputContext);
          // Não atualiza currentStepId: permanece no mesmo input para nova tentativa
        }
        break;

      case 'PICTURE_CHOICE': {
        // Para WhatsApp / canais com imagem: só avançar automaticamente quando a mensagem for de imagem.
        // Em outros canais (sem messageType), manter comportamento antigo (qualquer input é aceito).
        const messageType = inputMeta?.messageType;
        const isImageMessage =
          !messageType || messageType.toLowerCase() === 'image';

        if (!isImageMessage) {
          const choiceError =
            currentStep.config?.errorMessage ||
            'Envie uma imagem válida para continuar.';
          const choiceContext = (session.context as Record<string, any>) || {};
          await this.sendBotResponse(
            session.conversationId,
            {
              type: 'TEXT',
              content: choiceError,
            } as any,
            session.botId,
            choiceContext,
          );
          // Não avança de step
          break;
        }

        // Aguardar escolha de imagem (ou input válido) e salvar em variável
        const choiceContext = (session.context as Record<string, any>) || {};
        const choiceVariableName = currentStep.config?.variableName;
        if (choiceVariableName && input) {
          const updatedChoiceContext = this.variableService.setVariableValue(
            choiceContext,
            choiceVariableName,
            input,
          );
          await prisma.botSession.update({
            where: { id: session.id },
            data: { context: updatedChoiceContext },
          });
        }
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });

          // Se o próximo step for MESSAGE, executa imediatamente para o bot responder
          const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
          if (nextStep && nextStep.type === 'MESSAGE') {
            const updatedSession = {
              ...session,
              currentStepId: currentStep.nextStepId,
            };
            await this.executeFlow(
              flow,
              updatedSession,
              input,
              { ...(inputMeta || {}), _fromFlow: true } as any,
            );
          }
        }
        break;
      }

      case 'REDIRECT':
        // Enviar URL de redirecionamento como mensagem (link clicável)
        try {
          const redirectContext = (session.context as Record<string, any>) || {};
          const rawUrl = currentStep.config?.url || '';
          const redirectUrl = this.parseVariables(rawUrl, redirectContext);

          if (redirectUrl) {
            await this.sendBotResponse(
              session.conversationId,
              {
                type: 'TEXT',
                content: redirectUrl,
                metadata: {
                  redirectUrl,
                  openInNewTab: !!currentStep.config?.openInNewTab,
                },
              } as any,
              session.botId,
              redirectContext,
            );
          } else {
            console.warn('[BotService] Step REDIRECT sem URL definida');
          }
        } catch (error: any) {
          console.error('[BotService] Erro ao processar REDIRECT:', error.message);
        }

        // Avançar o fluxo normalmente após o redirect
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'SCRIPT':
        try {
          const scriptCode: string = currentStep.config?.code || currentStep.config?.script || '';
          const sessionContext = (session.context as Record<string, any>) || {};

          if (scriptCode && typeof scriptCode === 'string') {
            // Substituir {{variavel}} no código usando o contexto atual
            const parsedCode = this.parseVariables(scriptCode, sessionContext);

            let updatedContext: Record<string, any> = { ...sessionContext };
            const setVariable = (name: string, value: any) => {
              const cleanName = typeof name === 'string' ? name.trim() : name;
              if (!cleanName) return;
              updatedContext = this.variableService.setVariableValue(updatedContext, cleanName, value);
            };

            const sandbox = {
              context: updatedContext,
              input,
              message: input,
              setVariable,
            };

            const result = vm.runInNewContext(parsedCode, sandbox, {
              timeout: 5000,
            });

            // Se saveResultInVariable estiver definido, salvar o retorno do script
            const rawSaveVarName = currentStep.config?.saveResultInVariable;
            const saveVarName =
              typeof rawSaveVarName === 'string' ? rawSaveVarName.trim() : rawSaveVarName;
            if (saveVarName && result !== undefined) {
              updatedContext = this.variableService.setVariableValue(updatedContext, saveVarName, result);
            }

            // Persistir contexto atualizado na sessão
            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                context: updatedContext,
              },
            });

            // Atualizar contexto também no objeto de sessão em memória
            (session as any).context = updatedContext;
          } else {
            console.warn('[BotService] Step SCRIPT sem código definido');
          }
        } catch (scriptError: any) {
          console.error('[BotService] Erro ao executar SCRIPT:', scriptError.message);
        }

        // Avançar fluxo após executar script
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });

          const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
          if (nextStep && (nextStep.type === 'MESSAGE' || nextStep.type === 'CONDITION')) {
            const updatedSession = {
              ...session,
              currentStepId: currentStep.nextStepId,
              context: (session as any).context,
            };
            await this.executeFlow(
              flow,
              updatedSession as any,
              input,
              { ...(inputMeta || {}), _fromFlow: true } as any,
            );
          }
        }
        break;

      case 'WAIT': {
        // WAIT é um passo automático: só deve rodar quando chamado internamente pelo fluxo,
        // não quando o usuário envia uma nova mensagem enquanto o WAIT está ativo.
        if (!inputMeta?.['_fromFlow']) {
          console.log(
            `[BotService] WAIT chamado por mensagem do usuário; ignorando execução automática (step ${currentStep.id})`,
          );
          break;
        }

        // Aguardar um tempo e depois avançar automaticamente no fluxo
        // Suporta:
        // - waitTimeMs (milissegundos)
        // - waitTimeSeconds (segundos)
        // - waitTime (fallback genérico, em ms)
        const config = currentStep.config || {};
        const waitTimeMs =
          typeof config.waitTimeMs === 'number'
            ? config.waitTimeMs
            : typeof config.waitTimeSeconds === 'number'
            ? config.waitTimeSeconds * 1000
            : typeof config.waitTime === 'number'
            ? config.waitTime
            : 1000;

        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));

        const nextStepId = currentStep.nextStepId;

        if (!nextStepId) {
          console.log(
            `[BotService] Fluxo "${flow.name}" finalizado após WAIT (sem nextStepId configurado)`,
          );
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
          break;
        }

        if (nextStepId === 'END') {
          console.log(`[BotService] Fluxo "${flow.name}" finalizado após WAIT (step END)`);
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
          break;
        }

        // Atualizar sessão para o próximo step
        await prisma.botSession.update({
          where: { id: session.id },
          data: { currentStepId: nextStepId },
        });

        const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
        if (!nextStep) {
          console.warn(
            `[BotService] Step WAIT apontou para nextStepId inexistente: ${nextStepId}`,
          );
          break;
        }

        // Se o próximo step espera input (INPUT, TEXT_INPUT, etc.), apenas atualiza e para aqui.
        const inputSteps = [
          'PICTURE_CHOICE',
          'INPUT',
          'TEXT_INPUT',
          'EMAIL_INPUT',
          'NUMBER_INPUT',
          'PHONE_INPUT',
        ];
        if (inputSteps.includes(nextStep.type)) {
          console.log(
            `[BotService] WAIT concluído, aguardando input do usuário no step ${nextStep.id} (tipo: ${nextStep.type})`,
          );
          break;
        }

        // Para outros tipos (MESSAGE, CONDITION, SCRIPT, JUMP, HTTP_REQUEST, etc.) executar automaticamente
        const updatedSession = {
          ...session,
          currentStepId: nextStepId,
        };
        await this.executeFlow(
          flow,
          updatedSession as any,
          input,
          { ...(inputMeta || {}), _fromFlow: true, _fromWait: true } as any,
        );
        break;
      }

      case 'TYPEBOT_LINK':
        // Link para outro bot (sub-bot)
        // Por enquanto, apenas avançamos o fluxo
        // Implementação completa requereria gerenciamento de múltiplos bots
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'AB_TEST':
        // Teste A/B - escolher variante baseado em percentual
        const splitPercent = currentStep.config?.splitPercent || 50;
        const variants = currentStep.config?.variants || [];
        const random = Math.random() * 100;
        const selectedVariant = random < splitPercent ? variants[0] : variants[1];
        
        if (selectedVariant?.blockId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: selectedVariant.blockId },
          });
        } else if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'JUMP': {
        // JUMP também é um passo automático: evitar executar em mensagens do usuário
        // quando o fluxo já está parado neste step.
        if (!inputMeta?.['_fromFlow']) {
          console.log(
            `[BotService] JUMP chamado por mensagem do usuário; ignorando execução automática (step ${currentStep.id})`,
          );
          break;
        }

        // Pular para step específico definido na configuração (config.targetStepId)
        const targetStepId = currentStep.config?.targetStepId;

        if (!targetStepId) {
          console.warn('[BotService] Step JUMP sem targetStepId definido');
          break;
        }

        // Se o destino for END, finalizar o fluxo
        if (targetStepId === 'END') {
          console.log(`[BotService] Fluxo "${flow.name}" finalizado via JUMP (step END)`);
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
          break;
        }

        // Evitar loop direto para o mesmo step
        if (targetStepId === currentStep.id) {
          console.warn('[BotService] Step JUMP apontando para ele mesmo, ignorando para evitar loop');
          break;
        }

        // Atualizar sessão para o step de destino
        await prisma.botSession.update({
          where: { id: session.id },
          data: { currentStepId: targetStepId },
        });

        // Encontrar o step de destino no fluxo
        const targetStep = flow.steps.find((s: any) => s.id === targetStepId);
        if (!targetStep) {
          console.warn(
            `[BotService] Step JUMP apontou para targetStepId inexistente: ${targetStepId}`,
          );
          break;
        }

        // Executar automaticamente o step de destino
        const updatedSession = {
          ...session,
          currentStepId: targetStepId,
        };
        await this.executeFlow(
          flow,
          updatedSession as any,
          input,
          { ...(inputMeta || {}), _fromFlow: true, _fromJump: true } as any,
        );
        break;
      }

      default:
        // Tipo desconhecido - apenas avançar se houver próximo step
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;
    }
  }

  /**
   * Executa uma requisição HTTP
   */
  private async executeHttpRequest(config: any, context: Record<string, any>): Promise<any> {
    let url = this.parseVariables(config.url || '', context);
    let body = config.body ? this.parseVariables(config.body, context) : undefined;
    
    // Parse headers
    const headers: Record<string, string> = {};
    if (config.headers) {
      if (typeof config.headers === 'string') {
        try {
          const parsedHeaders = JSON.parse(config.headers);
          Object.assign(headers, parsedHeaders);
        } catch {
          // Se não for JSON válido, tratar como objeto
          Object.assign(headers, config.headers);
        }
      } else {
        Object.assign(headers, config.headers);
      }
      
      // Parse variáveis nos headers
      Object.keys(headers).forEach(key => {
        headers[key] = this.parseVariables(headers[key], context);
      });
    }
    
    // Headers padrão
    if (!headers['Content-Type'] && body) {
      headers['Content-Type'] = 'application/json';
    }
    
    const fetchOptions: RequestInit = {
      method: config.method || 'GET',
      headers: headers,
    };
    
    if (body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
      fetchOptions.body = body;
    }
    
    const response = await fetch(url, fetchOptions);
    
    // Tentar parsear como JSON, senão retornar texto
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  /**
   * Expõe teste de requisição HTTP para o frontend (sem afetar fluxo).
   */
  async testHttpRequest(config: any, context: Record<string, any> = {}): Promise<any> {
    return this.executeHttpRequest(config, context);
  }

  /**
   * Obtém um campo aninhado de um objeto usando caminho (ex: "data.id", "items[0].name")
   */
  private getNestedField(obj: any, path: string): any {
    if (!path || !obj) return undefined;
    
    const parts = path.split(/[\.\[\]]/).filter(p => p);
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      
      // Tentar como índice de array
      if (!isNaN(Number(part))) {
        current = current[Number(part)];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Valida input do usuário baseado nas regras do step
   */
  async validateInput(step: any, userInput: string): Promise<boolean> {
    const config = step.config || {};
    const validation = config.validation;
    const inputType = config.inputType || (step.type && step.type.replace('_INPUT', '')) || 'TEXT';

    // Validações específicas por tipo (sempre aplicadas quando o step é de número/email/telefone/data)
    if (inputType === 'NUMBER') {
      const trimmed = (userInput || '').trim();
      if (!trimmed) return false;
      const num = Number(trimmed);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        return false;
      }
      const min = config.min ?? validation?.min;
      const max = config.max ?? validation?.max;
      if (min !== undefined && min !== null && num < Number(min)) {
        return false;
      }
      if (max !== undefined && max !== null && num > Number(max)) {
        return false;
      }
    }

    if (inputType === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test((userInput || '').trim())) {
        return false;
      }
    }

    if (inputType === 'PHONE') {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test((userInput || '').trim())) {
        return false;
      }
    }

    if (!validation) return true;

    // Validação de obrigatório
    if (validation.required && (!userInput || !userInput.trim())) {
      return false;
    }

    // Validações de comprimento
    if (validation.minLength && userInput.length < validation.minLength) {
      return false;
    }
    if (validation.maxLength && userInput.length > validation.maxLength) {
      return false;
    }

    // Validação de padrão (regex)
    if (validation.pattern) {
      try {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(userInput)) {
          return false;
        }
      } catch (error) {
        console.error('[BotService] Erro ao validar pattern:', error);
      }
    }

    // Validação de escolha (para CHOICE)
    if (inputType === 'CHOICE' && step.config?.options) {
      const options = step.config.options;
      if (!options.includes(userInput)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Avalia uma condição (campo pode ser message.content ou context.nomeVariavel)
   */
  private evaluateCondition(condition: any, input: string, context: any): boolean {
    let value: any;

    if (condition.condition.startsWith('context.')) {
      const key = condition.condition.replace('context.', '');
      value = context[key];
    } else if (condition.condition === 'message.content') {
      value = input;
    } else {
      value = input;
    }

    switch (condition.operator) {
      case 'EQUALS':
        return String(value ?? '') === condition.value;
      case 'CONTAINS':
        return String(value ?? '').toLowerCase().includes((condition.value || '').toLowerCase());
      case 'GREATER_THAN':
        return Number(value) > Number(condition.value);
      case 'LESS_THAN':
        return Number(value) < Number(condition.value);
      case 'REGEX':
        try {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(String(value ?? ''));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Envia uma resposta do bot
   */
  private async sendBotResponse(conversationId: string, response: any, botId: string, context?: Record<string, any>) {
    try {
      // Buscar conversa para obter userId (pode ser null para mensagens do bot)
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      // Obter contexto da sessão se não fornecido
      let sessionContext = context;
      if (!sessionContext) {
        const session = await prisma.botSession.findUnique({
          where: { conversationId },
        });
        sessionContext = (session?.context as Record<string, any>) || {};
      }

      // Parse variáveis no conteúdo usando o novo parser
      let content = this.parseVariables(response.content, sessionContext);

      await this.messageService.sendMessage({
        conversationId,
        userId: '', // Bot não tem userId (será normalizado para null no MessageService)
        content,
        type: response.type || 'TEXT',
        mediaUrl: response.mediaUrl || undefined,
        fileName: response.metadata?.fileName || undefined,
        caption: content,
        fromBot: true,
      });

      console.log(`[BotService] Resposta do bot enviada para conversa ${conversationId}`);
    } catch (error: any) {
      console.error('[BotService] Erro ao enviar resposta do bot:', error.message);
      throw error;
    }
  }

  /**
   * Transfere conversa para agente humano
   */
  async handoffToHuman(sessionId: string, userId?: string) {
    const session = await prisma.botSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    await prisma.botSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        handoffToUserId: userId || null,
        handoffAt: new Date(),
      },
    });

    // Atualizar conversa se userId fornecido
    if (userId) {
      await prisma.conversation.update({
        where: { id: session.conversationId },
        data: {
          assignedToId: userId,
        },
      });
    }

    console.log(`[BotService] Handoff realizado para usuário ${userId || 'não especificado'}`);
  }

  /**
   * Cria uma intent
   */
  async createIntent(data: CreateIntentData) {
    const intent = await prisma.intent.create({
      data: {
        botId: data.botId,
        name: data.name,
        keywords: data.keywords,
        patterns: data.patterns || [],
        priority: data.priority || 0,
      },
    });

    return intent;
  }

  /**
   * Cria uma resposta
   */
  async createResponse(data: CreateResponseData) {
    const response = await prisma.response.create({
      data: {
        intentId: data.intentId,
        flowStepId: data.flowStepId,
        type: data.type,
        content: data.content,
        buttons: data.buttons,
        mediaUrl: data.mediaUrl,
        metadata: data.metadata,
        order: data.order || 0,
      },
    });

    return response;
  }

  /**
   * Cria um fluxo
   */
  async createFlow(data: { botId: string; name: string; description?: string; trigger?: string; triggerValue?: string }) {
    const existingFlowCount = await prisma.flow.count({
      where: {
        botId: data.botId,
      },
    });

    if (existingFlowCount > 0) {
      throw new Error('Este bot já possui um fluxo. Só é permitido um fluxo por bot.');
    }

    const flow = await prisma.flow.create({
      data: {
        botId: data.botId,
        name: data.name,
        description: data.description || null,
        trigger: data.trigger || 'always',
        triggerValue: data.triggerValue || null,
        isActive: true,
      },
      include: {
        steps: {
          include: {
            response: true,
            conditions: true,
            intent: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return flow;
  }

  /**
   * Obtém um fluxo por ID
   */
  async getFlowById(flowId: string) {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        steps: {
          include: {
            response: true,
            conditions: true,
            intent: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return flow;
  }

  /**
   * Cria um step em um fluxo
   */
  async createFlowStep(flowId: string, data: {
    type: string;
    order: number;
    config?: any;
    intentId?: string;
    responseId?: string;
    nextStepId?: string;
  }) {
    const step = await prisma.flowStep.create({
      data: {
        flowId,
        type: data.type,
        order: data.order,
        config: data.config || {},
        intentId: data.intentId,
        nextStepId: data.nextStepId,
      },
      include: {
        response: true,
        conditions: true,
        intent: true,
      },
    });

    return step;
  }

  /**
   * Atualiza um step
   */
  async updateFlowStep(stepId: string, data: {
    type?: string;
    order?: number;
    config?: any;
    intentId?: string;
    nextStepId?: string;
    responseId?: string | null;
  }) {
    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.config) updateData.config = data.config;
    if (data.intentId !== undefined) updateData.intentId = data.intentId;
    if (data.nextStepId !== undefined) updateData.nextStepId = data.nextStepId;
    if (data.responseId !== undefined) updateData.responseId = data.responseId;

    const step = await prisma.flowStep.update({
      where: { id: stepId },
      data: updateData,
      include: {
        response: true,
        conditions: true,
        intent: true,
      },
    });

    return step;
  }

  /**
   * Deleta um step
   */
  async deleteFlowStep(stepId: string) {
    await prisma.flowStep.delete({
      where: { id: stepId },
    });
  }

  /**
   * Cria uma condição para um step (permite múltiplas condições por step)
   */
  async createFlowCondition(stepId: string, data: {
    condition: string;
    operator: string;
    value: string;
    trueStepId?: string;
    falseStepId?: string;
    order?: number;
  }) {
    return await prisma.flowCondition.create({
      data: {
        stepId,
        condition: data.condition,
        operator: data.operator,
        value: data.value,
        trueStepId: data.trueStepId ?? null,
        falseStepId: data.falseStepId ?? null,
        order: data.order ?? 0,
      } as any,
    });
  }

  /**
   * Atualiza uma condição existente
   */
  async updateFlowCondition(conditionId: string, data: {
    condition?: string;
    operator?: string;
    value?: string;
    trueStepId?: string | null;
    falseStepId?: string | null;
    order?: number;
  }) {
    const updateData: any = {};
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.operator !== undefined) updateData.operator = data.operator;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.trueStepId !== undefined) updateData.trueStepId = data.trueStepId;
    if (data.falseStepId !== undefined) updateData.falseStepId = data.falseStepId;
    if (data.order !== undefined) updateData.order = data.order;

    return await prisma.flowCondition.update({
      where: { id: conditionId },
      data: updateData,
    });
  }

  /**
   * Remove uma condição
   */
  async deleteFlowCondition(conditionId: string) {
    return await prisma.flowCondition.delete({
      where: { id: conditionId },
    });
  }

  /**
   * Atualiza um bot
   */
  async updateBot(botId: string, data: {
    name?: string;
    description?: string;
    avatar?: string;
    language?: string;
    welcomeMessage?: string;
    fallbackMessage?: string;
    isActive?: boolean;
    autoCloseEnabled?: boolean;
    autoCloseAfterMinutes?: number | null;
    autoCloseMessage?: string | null;
  }) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.language) updateData.language = data.language;
    if (data.welcomeMessage !== undefined) updateData.welcomeMessage = data.welcomeMessage;
    if (data.fallbackMessage !== undefined) updateData.fallbackMessage = data.fallbackMessage;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.autoCloseEnabled !== undefined) updateData.autoCloseEnabled = data.autoCloseEnabled;
    if (data.autoCloseAfterMinutes !== undefined) updateData.autoCloseAfterMinutes = data.autoCloseAfterMinutes;
    if (data.autoCloseMessage !== undefined) updateData.autoCloseMessage = data.autoCloseMessage;

    const bot = await prisma.bot.update({
      where: { id: botId },
      data: updateData,
    });

    return bot;
  }

  /**
   * Deleta um bot
   */
  async deleteBot(botId: string) {
    await prisma.bot.delete({
      where: { id: botId },
    });
  }

  /**
   * Encerra automaticamente conversas inativas com base na configuração do bot.
   * - Considera lastCustomerMessageAt da Conversation vinculada à BotSession.
   * - Envia mensagem de encerramento e marca a conversa como CLOSED.
   */
  async autoCloseInactiveConversations() {
    try {
      const bots = await prisma.bot.findMany({
        where: {
          autoCloseEnabled: true,
          autoCloseAfterMinutes: {
            not: null,
          },
        },
      });

      if (!bots.length) {
        return;
      }

      const now = new Date();

      for (const bot of bots) {
        const minutes = bot.autoCloseAfterMinutes || 0;
        if (!minutes || minutes <= 0) continue;

        const threshold = new Date(now.getTime() - minutes * 60 * 1000);

        const sessions = await prisma.botSession.findMany({
          where: {
            botId: bot.id,
            isActive: true,
            conversation: {
              status: 'OPEN',
              lastCustomerMessageAt: {
                not: null,
                lte: threshold,
              },
            },
          },
          include: {
            conversation: true,
          },
        });

        if (!sessions.length) continue;

        const closeMessage =
          bot.autoCloseMessage ||
          'Encerramos este atendimento por inatividade. Se precisar de algo, é só mandar uma nova mensagem.';

        for (const session of sessions) {
          try {
            const context = (session.context as Record<string, any>) || {};

            // Enviar mensagem de encerramento via bot
            await this.sendBotResponse(
              session.conversationId,
              {
                type: 'TEXT',
                content: closeMessage,
              } as any,
              bot.id,
              context,
            );

            // Marcar conversa como fechada
            await prisma.conversation.update({
              where: { id: session.conversationId },
              data: {
                status: 'CLOSED',
                lastAgentMessageAt: now,
              },
            });

            // Encerrar sessão do bot
            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                isActive: false,
                currentFlowId: null,
                currentStepId: null,
              },
            });

            console.log(
              `[BotService] Conversa ${session.conversationId} encerrada automaticamente por inatividade (bot ${bot.id})`,
            );
          } catch (e: any) {
            console.error(
              '[BotService] Erro ao encerrar conversa automaticamente:',
              e.message,
              'conversa:',
              session.conversationId,
            );
          }
        }
      }
    } catch (error: any) {
      console.error('[BotService] Erro geral no autoCloseInactiveConversations:', error.message);
    }
  }
}

