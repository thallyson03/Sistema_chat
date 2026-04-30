import prisma from '../config/database';
import { MessageService } from './messageService';
import { BotVariableService } from './botVariableService';
import { dispatchJourneyEvent } from './journeyEventDispatcher';
import vm from 'vm';
import axios from 'axios';
import { resolvePublicAppBaseUrl } from '../utils/publicBaseUrl';

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
        // Novo bot nasce como rascunho (não entra em produção até publicar)
        isActive: false,
        publishedVersion: '0.0',
        hasPendingChanges: true,
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
        // Fluxo inicial é rascunho (não publicado)
        isActive: false,
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
        flows: {
          select: {
            id: true,
            isActive: true,
            updatedAt: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bots.map((bot: any) => {
      const draftFlow = (bot.flows || []).find((f: any) => !f.isActive);
      const activeFlow = (bot.flows || []).find((f: any) => f.isActive);
      return {
        ...bot,
        hasDraftFlow: !!draftFlow,
        draftFlowUpdatedAt: draftFlow?.updatedAt || null,
        activeFlowUpdatedAt: activeFlow?.updatedAt || null,
        publishedVersion: bot.publishedVersion || '0.0',
        hasPendingChanges: !!bot.hasPendingChanges,
      };
    });
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
          orderBy: {
            updatedAt: 'desc',
          },
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

    const explicitStart = steps.find((step: any) => step?.config?.isStart === true);
    if (explicitStart) {
      return explicitStart;
    }

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
      if (s.type === 'MESSAGE' && Array.isArray(s?.config?.buttons)) {
        for (const btn of s.config.buttons) {
          if (btn?.nextStepId && btn.nextStepId !== 'END') {
            referencedIds.add(btn.nextStepId);
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

    const inputStepTypes = [
      'PICTURE_CHOICE',
      'INPUT',
      'TEXT_INPUT',
      'EMAIL_INPUT',
      'NUMBER_INPUT',
      'PHONE_INPUT',
      'DATE_INPUT',
      'FILE_UPLOAD',
    ];

    const advanceToNextStep = async (
      nextStepId: string | null | undefined,
      reason: string,
    ) => {
      if (!nextStepId) {
        console.log(
          `[BotService] Fluxo "${flow.name}" finalizado ${reason} (sem próximo step)`,
        );
        await prisma.botSession.update({
          where: { id: session.id },
          data: {
            currentFlowId: null,
            currentStepId: null,
          },
        });
        return;
      }

      if (nextStepId === 'END') {
        console.log(`[BotService] Fluxo "${flow.name}" finalizado ${reason} (step END)`);
        await prisma.botSession.update({
          where: { id: session.id },
          data: {
            currentFlowId: null,
            currentStepId: null,
          },
        });
        return;
      }

      await prisma.botSession.update({
        where: { id: session.id },
        data: { currentStepId: nextStepId },
      });

      const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
      if (!nextStep) {
        console.warn(
          `[BotService] Próximo step não encontrado após ${currentStep.type}: ${nextStepId}`,
        );
        return;
      }

      if (inputStepTypes.includes(nextStep.type)) {
        console.log(
          `[BotService] Aguardando input/imagem do usuário no step ${nextStep.id} (tipo: ${nextStep.type})`,
        );
        return;
      }

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
    };

    // Processar step baseado no tipo
    switch (currentStep.type) {
      case 'MESSAGE':
        if (!currentStep.response) {
          console.warn(`[BotService] Step MESSAGE sem resposta configurada`);
          await advanceToNextStep(currentStep.nextStepId, 'step MESSAGE sem response');
          break;
        }

        const responseButtons = Array.isArray(currentStep.response?.buttons)
          ? currentStep.response.buttons
          : [];
        const configButtons = Array.isArray(currentStep.config?.buttons)
          ? currentStep.config.buttons
          : [];
        const effectiveButtons = configButtons.length > 0 ? configButtons : responseButtons;
        const hasButtons = effectiveButtons.length > 0;
        const isFlowDrivenExecution = !!inputMeta?.['_fromFlow'];

        // Primeiro envio do bloco MESSAGE (ou execução automática): envia a mensagem
        // e, se houver botões, aguarda escolha do usuário sem avançar automaticamente.
        if (isFlowDrivenExecution) {
          console.log(`[BotService] Enviando mensagem do step:`, currentStep.response.content?.substring(0, 50));
          const sessionContext = (session.context as Record<string, any>) || {};
          const responseToSend =
            responseButtons.length > 0
              ? currentStep.response
              : {
                  ...currentStep.response,
                  buttons: configButtons,
                };
          await this.sendBotResponse(session.conversationId, responseToSend as any, session.botId, sessionContext);

          if (hasButtons) {
            console.log('[BotService] MESSAGE com botões: aguardando escolha do usuário');
            break;
          }

          await advanceToNextStep(currentStep.nextStepId, 'após MESSAGE sem botões');
          break;
        }

        // Quando o step MESSAGE possui botões e a execução veio de input do usuário,
        // interpretar a resposta e rotear para o nextStepId do botão escolhido.
        if (hasButtons) {
          const normalizedInput = String(input || '').trim().toLowerCase();
          const numericIndex = Number.parseInt(normalizedInput, 10);
          const selectedByNumber =
            Number.isFinite(numericIndex) && numericIndex >= 1 && numericIndex <= effectiveButtons.length
              ? effectiveButtons[numericIndex - 1]
              : null;

          const selectedByMatch = effectiveButtons.find((btn: any) => {
            const text = String(btn?.text || btn?.title || '').trim().toLowerCase();
            const id = String(btn?.id || btn?.value || '').trim().toLowerCase();
            return normalizedInput.length > 0 && (normalizedInput === text || normalizedInput === id);
          });

          const selectedButton = selectedByNumber || selectedByMatch || null;
          if (!selectedButton) {
            console.log('[BotService] Resposta não corresponde a nenhum botão; mantendo no step atual');
            break;
          }

          const buttonNextStepId = selectedButton?.nextStepId;
          console.log('[BotService] Botão selecionado no MESSAGE:', {
            input,
            selectedButtonText: selectedButton?.text || selectedButton?.title || null,
            selectedButtonId: selectedButton?.id || selectedButton?.value || null,
            selectedButtonNextStepId: buttonNextStepId || null,
            source: configButtons.length > 0 ? 'config.buttons' : 'response.buttons',
          });
          await advanceToNextStep(buttonNextStepId, 'após escolha de botão em MESSAGE');
          break;
        }

        // Sem botões e sem _fromFlow: não deve reprocessar o bloco nem avançar por fallback.
        // Mantemos o fluxo no step atual para evitar saltos inesperados.
        console.log('[BotService] MESSAGE sem botões recebido fora de _fromFlow; sem autoavançar');
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
          await advanceToNextStep(currentStep.nextStepId, 'após MOVE_DEAL sem destino configurado');
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
          await advanceToNextStep(currentStep.nextStepId, 'após MOVE_DEAL sem deal vinculado');
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
            await advanceToNextStep(currentStep.nextStepId, 'após MOVE_DEAL com stage inválida');
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
            await advanceToNextStep(currentStep.nextStepId, 'após MOVE_DEAL sem stage ativa');
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
        await advanceToNextStep(currentStep.nextStepId, 'após MOVE_DEAL');
        break;
      }

      case 'CRM_LEAD_STATUS': {
        const targetPipelineId = String(currentStep.config?.pipelineId || '').trim();
        const targetStageId = String(currentStep.config?.stageId || '').trim();

        if (!targetPipelineId && !targetStageId) {
          console.warn('[BotService] CRM_LEAD_STATUS sem pipeline/coluna de destino configurados');
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_STATUS sem destino');
          break;
        }

        const deal = await prisma.deal.findFirst({
          where: { conversationId: session.conversationId },
          select: { id: true, pipelineId: true, stageId: true },
        });
        if (!deal) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_STATUS sem deal');
          break;
        }

        let finalStageId: string | null = targetStageId || null;
        let finalPipelineId: string = targetPipelineId || deal.pipelineId;

        if (targetStageId) {
          const stage = await prisma.pipelineStage.findUnique({
            where: { id: targetStageId },
            select: { id: true, pipelineId: true },
          });
          if (!stage) {
            await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_STATUS com coluna inválida');
            break;
          }
          finalStageId = stage.id;
          finalPipelineId = stage.pipelineId;
        } else if (targetPipelineId) {
          const firstStage = await prisma.pipelineStage.findFirst({
            where: { pipelineId: targetPipelineId, isActive: true },
            orderBy: { order: 'asc' },
            select: { id: true, pipelineId: true },
          });
          if (!firstStage) {
            await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_STATUS sem coluna ativa');
            break;
          }
          finalStageId = firstStage.id;
          finalPipelineId = firstStage.pipelineId;
        }

        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            pipelineId: finalPipelineId,
            stageId: finalStageId || deal.stageId,
          },
        });

        await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_STATUS');
        break;
      }

      case 'CRM_LEAD_OWNER': {
        const mode = String(currentStep.config?.mode || 'SET').toUpperCase();
        const userId = String(currentStep.config?.userId || '').trim();
        const deal = await prisma.deal.findFirst({
          where: { conversationId: session.conversationId },
          select: { id: true },
        });
        if (!deal) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_OWNER sem deal');
          break;
        }
        let assignedToId: string | null = null;
        if (mode === 'REMOVE') {
          assignedToId = null;
        } else if (mode === 'RULE_SECTOR_RANDOM') {
          const conversation = await prisma.conversation.findUnique({
            where: { id: session.conversationId },
            select: { sectorId: true, assignedToId: true },
          });
          if (conversation?.sectorId) {
            const users = await prisma.userSector.findMany({
              where: { sectorId: conversation.sectorId },
              select: { userId: true },
            });
            if (users.length > 0) {
              const randomIndex = Math.floor(Math.random() * users.length);
              assignedToId = users[randomIndex].userId;
            } else {
              assignedToId = conversation.assignedToId || null;
            }
          }
        } else if (mode === 'RULE_CONVERSATION_OWNER') {
          const conversation = await prisma.conversation.findUnique({
            where: { id: session.conversationId },
            select: { assignedToId: true },
          });
          assignedToId = conversation?.assignedToId || null;
        } else {
          assignedToId = userId || null;
        }
        await prisma.deal.update({ where: { id: deal.id }, data: { assignedToId } });
        await prisma.conversation.update({
          where: { id: session.conversationId },
          data: { assignedToId },
        });
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_LEAD_OWNER');
        break;
      }

      case 'CRM_MANAGE_TAGS': {
        const mode = String(currentStep.config?.mode || 'ADD').toUpperCase();
        const configuredTags = Array.isArray(currentStep.config?.tags) ? currentStep.config.tags : [];
        const tagNames = configuredTags
          .map((name: any) => this.parseVariables(String(name || ''), (session.context as Record<string, any>) || {}))
          .map((name: string) => name.trim())
          .filter((name: string) => name.length > 0);
        if (tagNames.length === 0) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_MANAGE_TAGS sem tags');
          break;
        }

        const existingTags = await prisma.tag.findMany({
          where: { name: { in: tagNames } },
          select: { id: true, name: true },
        });
        const tagByName = new Map(existingTags.map((tag) => [tag.name, tag]));
        const finalTags: Array<{ id: string; name: string }> = [];
        for (const tagName of tagNames) {
          const existing = tagByName.get(tagName);
          if (existing) {
            finalTags.push(existing);
            continue;
          }
          const created = await prisma.tag.create({
            data: { name: tagName },
            select: { id: true, name: true },
          });
          finalTags.push(created);
        }

        if (mode === 'REPLACE') {
          await prisma.conversationTag.deleteMany({ where: { conversationId: session.conversationId } });
        }

        if (mode === 'REMOVE') {
          await prisma.conversationTag.deleteMany({
            where: {
              conversationId: session.conversationId,
              tagId: { in: finalTags.map((tag) => tag.id) },
            },
          });
        } else {
          const conversation = await prisma.conversation.findUnique({
            where: { id: session.conversationId },
            select: { contactId: true, channelId: true },
          });
          for (const tag of finalTags) {
            await prisma.conversationTag.upsert({
              where: {
                conversationId_tagId: {
                  conversationId: session.conversationId,
                  tagId: tag.id,
                },
              },
              update: {},
              create: {
                conversationId: session.conversationId,
                tagId: tag.id,
              },
            });
            if (conversation?.contactId) {
              await dispatchJourneyEvent('tag_added', {
                contactId: conversation.contactId,
                channelId: conversation.channelId,
                conversationId: session.conversationId,
                tagName: tag.name,
              });
            }
          }
        }

        await advanceToNextStep(currentStep.nextStepId, 'após CRM_MANAGE_TAGS');
        break;
      }

      case 'CRM_ADD_TASK': {
        console.log('[BotService] CRM_ADD_TASK iniciado', {
          conversationId: session.conversationId,
          contextDealId: (session.context as any)?.dealId || null,
        });
        const title = this.parseVariables(
          String(currentStep.config?.title || '').trim(),
          (session.context as Record<string, any>) || {},
        );
        if (!title) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_TASK inválido');
          break;
        }
        const contextDealId = String((session.context as any)?.dealId || '').trim();
        const deal =
          (contextDealId
            ? await prisma.deal.findUnique({
                where: { id: contextDealId },
                select: { id: true },
              })
            : null) ||
          (await prisma.deal.findFirst({
            where: { conversationId: session.conversationId },
            select: { id: true },
          }));
        if (!deal) {
          console.warn('[BotService] CRM_ADD_TASK sem deal identificado', {
            conversationId: session.conversationId,
            contextDealId: (session.context as any)?.dealId || null,
          });
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_TASK sem deal');
          break;
        }
        const dueDateRaw = String(currentStep.config?.dueDate || '').trim();
        let dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
        // Regra solicitada: quando não há prazo informado, usar data/hora atual.
        if (!dueDate || Number.isNaN(dueDate.getTime())) {
          dueDate = new Date();
        }
        const createdTask = await prisma.pipelineTask.create({
          data: {
            dealId: deal.id,
            title,
            description: currentStep.config?.description
              ? this.parseVariables(String(currentStep.config.description), (session.context as Record<string, any>) || {})
              : null,
            dueDate,
          },
        });

        // Notificação imediata no chat (mesmo padrão visual das tarefas de pipeline)
        // para garantir que o usuário veja a criação da tarefa em tempo real.
        const notifyInChat = currentStep.config?.notifyInChat !== false;
        if (notifyInChat) {
          try {
            const conversationForNotify = await prisma.conversation.findUnique({
              where: { id: session.conversationId },
              select: {
                id: true,
                channelId: true,
                contact: {
                  select: {
                    channelId: true,
                  },
                },
              },
            });

            // Tarefa do bot nunca deve depender de canal.
            // Se houver canal no contato, tentamos preencher na conversa para notificar no chat.
            if (!conversationForNotify?.channelId && conversationForNotify?.contact?.channelId) {
              await prisma.conversation.update({
                where: { id: session.conversationId },
                data: { channelId: conversationForNotify.contact.channelId },
              });
              console.log('[BotService] CRM_ADD_TASK vinculou canal na conversa para notificação', {
                conversationId: session.conversationId,
                channelId: conversationForNotify.contact.channelId,
              });
            }

            const contentLines = [
              '🤖 Tarefa criada pelo bot deste negócio.',
              '',
              `• Tarefa: ${createdTask.title}`,
            ];
            if (createdTask.description) {
              contentLines.push(`• Detalhes: ${createdTask.description}`);
            }
            await this.messageService.sendMessage({
              conversationId: session.conversationId,
              userId: '',
              content: contentLines.join('\n'),
              type: 'TEXT',
              fromBot: true,
              internalOnly: true,
              metadata: {
                source: 'BOT_CRM_ADD_TASK',
                taskNotification: {
                  taskId: createdTask.id,
                  dealId: deal.id,
                  title: createdTask.title,
                  description: createdTask.description || '',
                  dueDate: createdTask.dueDate ? createdTask.dueDate.toISOString() : null,
                  status: createdTask.status,
                },
              },
            });
          } catch (err: any) {
            // Não impedir a automação quando a conversa estiver sem canal.
            // Nesse cenário a tarefa já foi criada e deve permanecer válida.
            console.warn('[BotService] CRM_ADD_TASK não conseguiu enviar notificação no chat', {
              taskId: createdTask.id,
              conversationId: session.conversationId,
              error: err?.message || err,
            });
          }

          // Se a tarefa já venceu (ou é imediata), marcamos como notificada
          // para evitar notificações duplicadas no job de tarefas.
          if (createdTask.dueDate && createdTask.dueDate.getTime() <= Date.now()) {
            await prisma.pipelineTask.update({
              where: { id: createdTask.id },
              data: { notified: true },
            });
          }
        }
        console.log('[BotService] CRM_ADD_TASK criado com sucesso', {
          dealId: deal.id,
          taskId: createdTask.id,
          title: createdTask.title,
          source: 'BOT_CRM_ADD_TASK',
          notifyInChat,
        });
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_TASK');
        break;
      }

      case 'CRM_ADD_NOTE': {
        const note = this.parseVariables(
          String(currentStep.config?.note || '').trim(),
          (session.context as Record<string, any>) || {},
        );
        if (!note) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_NOTE inválido');
          break;
        }
        const deal = await prisma.deal.findFirst({
          where: { conversationId: session.conversationId },
          select: { id: true },
        });
        if (!deal) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_NOTE sem deal');
          break;
        }
        await prisma.dealActivity.create({
          data: {
            dealId: deal.id,
            type: 'NOTE',
            title: 'Nota adicionada pelo bot',
            description: note,
          },
        });
        try {
          await this.messageService.sendMessage({
            conversationId: session.conversationId,
            userId: '',
            content: `📝 Nota adicionada pelo bot\n\n${note}`,
            type: 'TEXT',
            fromBot: true,
            internalOnly: true,
            metadata: {
              source: 'BOT_CRM_ADD_NOTE',
              noteNotification: {
                dealId: deal.id,
                note,
              },
            },
          });
        } catch (err: any) {
          console.warn('[BotService] CRM_ADD_NOTE não conseguiu enviar nota no chat', {
            dealId: deal.id,
            conversationId: session.conversationId,
            error: err?.message || err,
          });
        }
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_ADD_NOTE');
        break;
      }

      case 'CRM_CREATE_LEAD': {
        // Bloco removido do produto: mantemos apenas compatibilidade para fluxos antigos.
        console.warn('[BotService] CRM_CREATE_LEAD ignorado (bloco removido)', {
          conversationId: session.conversationId,
          stepId: currentStep.id,
        });
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_CREATE_LEAD removido');
        break;
      }

      case 'CRM_COMPLETE_TASKS': {
        const mode = String(currentStep.config?.mode || 'ALL_PENDING').toUpperCase();
        const deal = await prisma.deal.findFirst({
          where: { conversationId: session.conversationId },
          select: { id: true },
        });
        if (!deal) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_COMPLETE_TASKS sem deal');
          break;
        }
        if (mode === 'BY_TITLE') {
          const taskTitle = this.parseVariables(
            String(currentStep.config?.taskTitle || '').trim(),
            (session.context as Record<string, any>) || {},
          );
          if (taskTitle) {
            await prisma.pipelineTask.updateMany({
              where: { dealId: deal.id, status: 'PENDING', title: taskTitle },
              data: { status: 'DONE' },
            });
          }
        } else if (mode === 'BY_ID') {
          const taskId = String(currentStep.config?.taskId || '').trim();
          if (taskId) {
            await prisma.pipelineTask.updateMany({
              where: { id: taskId, dealId: deal.id, status: 'PENDING' },
              data: { status: 'DONE' },
            });
          }
        } else {
          await prisma.pipelineTask.updateMany({
            where: { dealId: deal.id, status: 'PENDING' },
            data: { status: 'DONE' },
          });
        }
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_COMPLETE_TASKS');
        break;
      }

      case 'CRM_CONVERSATION_STATUS': {
        const status = this.normalizeEnumValue(currentStep.config?.status);
        const allowedStatuses = new Set(['OPEN', 'WAITING', 'CLOSED', 'ARCHIVED']);
        if (!allowedStatuses.has(status)) {
          await advanceToNextStep(currentStep.nextStepId, 'após CRM_CONVERSATION_STATUS inválido');
          break;
        }
        await prisma.conversation.update({
          where: { id: session.conversationId },
          data: { status: status as any },
        });
        await advanceToNextStep(currentStep.nextStepId, 'após CRM_CONVERSATION_STATUS');
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

          // Executar automaticamente o próximo step se NÃO for bloco de entrada
          if (nextStepId !== 'END') {
            const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
            if (nextStep && !inputStepTypes.includes(nextStep.type)) {
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
        await advanceToNextStep(currentStep.nextStepId, 'após DELAY');
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
              
              // Executar próximo step automaticamente se NÃO for bloco de entrada
              const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
              if (nextStep && !inputStepTypes.includes(nextStep.type)) {
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

        // Executar automaticamente o próximo step se NÃO for bloco de entrada
        const nextStep = flow.steps.find((s: any) => s.id === nextStepId);
        if (nextStep && !inputStepTypes.includes(nextStep.type)) {
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
        const imageUrl = this.parseVariables(
          currentStep.config?.imageUrl || currentStep.response?.mediaUrl || '',
          (session.context as Record<string, any>) || {},
        );
        await this.sendBotResponse(session.conversationId, {
          type: 'IMAGE',
          content: currentStep.config?.altText || currentStep.response?.content || '',
          mediaUrl: imageUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        await advanceToNextStep(currentStep.nextStepId, 'após IMAGE');
        break;

      case 'VIDEO':
        // Enviar vídeo
        const videoUrl = this.parseVariables(
          currentStep.config?.videoUrl || currentStep.response?.mediaUrl || '',
          (session.context as Record<string, any>) || {},
        );
        await this.sendBotResponse(session.conversationId, {
          type: 'VIDEO',
          content: currentStep.response?.content || '',
          mediaUrl: videoUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        await advanceToNextStep(currentStep.nextStepId, 'após VIDEO');
        break;

      case 'AUDIO':
        // Enviar áudio
        const audioUrl = this.parseVariables(
          currentStep.config?.audioUrl || currentStep.response?.mediaUrl || '',
          (session.context as Record<string, any>) || {},
        );
        await this.sendBotResponse(session.conversationId, {
          type: 'AUDIO',
          content: currentStep.response?.content || '',
          mediaUrl: audioUrl,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        await advanceToNextStep(currentStep.nextStepId, 'após AUDIO');
        break;

      case 'EMBED':
        // Enviar embed (como mensagem de texto com URL)
        const embedUrl = this.parseVariables(currentStep.config?.embedUrl || '', (session.context as Record<string, any>) || {});
        await this.sendBotResponse(session.conversationId, {
          type: 'TEXT',
          content: `Embed: ${embedUrl}`,
        } as any, session.botId, (session.context as Record<string, any>) || {});
        await advanceToNextStep(currentStep.nextStepId, 'após EMBED');
        break;

      case 'EMAIL_INPUT':
      case 'NUMBER_INPUT':
      case 'PHONE_INPUT':
      case 'DATE_INPUT':
      case 'FILE_UPLOAD':
        // Tratar como INPUT genérico com validação específica
        const inputType = currentStep.type.replace('_INPUT', '');
        const normalizedInputValue = String(input ?? '').trim();
        const isValidInput = await this.validateInput(
          { ...currentStep, config: { ...currentStep.config, inputType } },
          normalizedInputValue,
        );
        const inputContext = (session.context as Record<string, any>) || {};
        
        if (isValidInput) {
          const inputVariableName = currentStep.config?.variableName;
          let updatedInputContext = inputContext;
          if (inputVariableName) {
            updatedInputContext = this.variableService.setVariableValue(
              inputContext,
              inputVariableName,
              normalizedInputValue,
            );
            await prisma.botSession.update({
              where: { id: session.id },
              data: { context: updatedInputContext },
            });
          }

          // Mesmo comportamento do INPUT/TEXT_INPUT:
          // avançar e executar próximo step automaticamente quando aplicável.
          (session as any).context = updatedInputContext;
          await advanceToNextStep(currentStep.nextStepId, `após ${currentStep.type}`);
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

          // Se o próximo step NÃO for bloco de entrada, executa imediatamente
          const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
          if (nextStep && !inputStepTypes.includes(nextStep.type)) {
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
        await advanceToNextStep(currentStep.nextStepId, 'após REDIRECT');
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
          if (nextStep && !inputStepTypes.includes(nextStep.type)) {
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
        await advanceToNextStep(currentStep.nextStepId, 'após TYPEBOT_LINK');
        break;

      case 'AB_TEST':
        // Teste A/B - escolher variante baseado em percentual
        const splitPercent = currentStep.config?.splitPercent || 50;
        const variants = currentStep.config?.variants || [];
        const random = Math.random() * 100;
        const selectedVariant = random < splitPercent ? variants[0] : variants[1];

        await advanceToNextStep(
          selectedVariant?.blockId || currentStep.nextStepId,
          'após AB_TEST',
        );
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
      const digitsOnly = trimmed.replace(/\D/g, '');
      const minDigits =
        config.minDigits ??
        config.minLength ??
        validation?.minLength;
      const maxDigits =
        config.maxDigits ??
        config.maxLength ??
        validation?.maxLength;

      if (minDigits !== undefined && minDigits !== null && digitsOnly.length < Number(minDigits)) {
        return false;
      }
      if (maxDigits !== undefined && maxDigits !== null && digitsOnly.length > Number(maxDigits)) {
        return false;
      }

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

    // Para NUMBER_INPUT, priorizar validação numérica (min/max) para evitar
    // bloqueios indevidos por regras legadas de string (ex.: maxLength=1).
    if (inputType !== 'NUMBER') {
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

  private normalizeEnumValue(value: any): string {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  /**
   * Envia uma resposta do bot
   */
  private buildAbsoluteMediaUrl(mediaUrl: string): string {
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      return mediaUrl;
    }

    if (mediaUrl.startsWith('/')) {
      const publicBaseUrl = resolvePublicAppBaseUrl();
      if (!publicBaseUrl) {
        throw new Error(
          '[BotService] mediaUrl relativa sem base pública válida. Configure PUBLIC_APP_URL/APP_URL.',
        );
      }
      return `${publicBaseUrl}${mediaUrl}`;
    }

    throw new Error(`[BotService] mediaUrl inválida: ${mediaUrl}`);
  }

  private async ensureMediaUrlReachable(mediaUrl: string, responseType: string): Promise<string> {
    const absoluteMediaUrl = this.buildAbsoluteMediaUrl(mediaUrl);

    try {
      const response = await axios.get(absoluteMediaUrl, {
        responseType: 'stream',
        timeout: 10000,
        headers: { Range: 'bytes=0-0' },
        validateStatus: (status) => (status >= 200 && status < 400) || status === 206,
      });

      response.data?.destroy?.();
      return absoluteMediaUrl;
    } catch (error: any) {
      const status = error?.response?.status;
      const reason = status ? `HTTP ${status}` : error?.message || 'erro desconhecido';
      throw new Error(
        `[BotService] Step ${responseType} com mediaUrl inacessível (${reason}): ${absoluteMediaUrl}`,
      );
    }
  }

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
      const content = this.parseVariables(response.content, sessionContext);
      const responseType = String(response.type || 'TEXT').toUpperCase();
      const parsedMediaUrl =
        typeof response.mediaUrl === 'string'
          ? this.parseVariables(response.mediaUrl, sessionContext).trim()
          : '';

      const mediaTypes = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];
      const isMediaStep = mediaTypes.includes(responseType);
      let finalMediaUrl = parsedMediaUrl || undefined;

      // Regra de negócio: se um bloco de mídia falhar (URL ausente/inválida), não pode avançar.
      if (isMediaStep && !parsedMediaUrl) {
        throw new Error(
          `[BotService] Step ${responseType} sem mediaUrl configurada (flow bloqueado até corrigir o bloco).`,
        );
      }

      if (isMediaStep && parsedMediaUrl) {
        finalMediaUrl = await this.ensureMediaUrlReachable(parsedMediaUrl, responseType);
      }

      await this.messageService.sendMessage({
        conversationId,
        userId: '', // Bot não tem userId (será normalizado para null no MessageService)
        content: content || '',
        type: responseType,
        mediaUrl: finalMediaUrl,
        fileName: response.metadata?.fileName || undefined,
        caption: content || '',
        buttons: Array.isArray(response.buttons) ? response.buttons : undefined,
        metadata: response.metadata || undefined,
        fromBot: true,
      });

      console.log('[BotService] Payload de resposta enviado:', {
        type: responseType,
        buttonsCount: Array.isArray(response.buttons) ? response.buttons.length : 0,
        interactiveType: response?.metadata?.interactiveType || null,
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
    const response =
      data.flowStepId
        ? await prisma.response.upsert({
            where: { flowStepId: data.flowStepId },
            update: {
              intentId: data.intentId,
              type: data.type,
              content: data.content,
              buttons: data.buttons,
              mediaUrl: data.mediaUrl,
              metadata: data.metadata,
              order: data.order || 0,
            },
            create: {
              intentId: data.intentId,
              flowStepId: data.flowStepId,
              type: data.type,
              content: data.content,
              buttons: data.buttons,
              mediaUrl: data.mediaUrl,
              metadata: data.metadata,
              order: data.order || 0,
            },
          })
        : await prisma.response.create({
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

    if (data.flowStepId) {
      await this.markBotPendingByStepId(data.flowStepId);
    }

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

  private incrementPublishedVersion(currentVersion?: string | null): string {
    const current = String(currentVersion || '0.0').trim();
    const [majorRaw, minorRaw] = current.split('.');
    const major = Number.parseInt(majorRaw, 10);
    const minor = Number.parseInt(minorRaw || '0', 10);

    if (!Number.isFinite(major) || !Number.isFinite(minor)) {
      return '1.0';
    }

    if (major <= 0) {
      return '1.0';
    }

    return `${major}.${minor + 1}`;
  }

  private async markBotPendingByFlowId(flowId: string) {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { botId: true },
    });
    if (!flow?.botId) return;
    await prisma.bot.update({
      where: { id: flow.botId },
      data: { hasPendingChanges: true },
    });
  }

  private async markBotPendingByStepId(stepId: string) {
    const step = await prisma.flowStep.findUnique({
      where: { id: stepId },
      select: { flowId: true },
    });
    if (!step?.flowId) return;
    await this.markBotPendingByFlowId(step.flowId);
  }

  /**
   * Garante um fluxo de rascunho para edição sem impactar produção.
   * Estratégia:
   * - Se já existir rascunho (isActive=false), reutiliza o mais recente.
   * - Senão, clona o fluxo ativo atual para um novo rascunho.
   * - Se não houver fluxo ativo, cria rascunho vazio padrão.
   */
  async ensureDraftFlow(botId: string) {
    const existingDraft = await prisma.flow.findFirst({
      where: {
        botId,
        isActive: false,
      },
      include: {
        steps: {
          include: {
            response: true,
            conditions: true,
            intent: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingDraft) {
      return existingDraft;
    }

    const activeFlow = await prisma.flow.findFirst({
      where: {
        botId,
        isActive: true,
      },
      include: {
        steps: {
          include: {
            response: true,
            conditions: true,
            intent: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!activeFlow) {
      const createdDraft = await prisma.flow.create({
        data: {
          botId,
          name: 'Rascunho',
          description: 'Fluxo de rascunho',
          trigger: 'always',
          triggerValue: null,
          isActive: false,
        },
        include: {
          steps: {
            include: {
              response: true,
              conditions: true,
              intent: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      });
      await prisma.bot.update({
        where: { id: botId },
        data: { hasPendingChanges: true },
      });
      return createdDraft;
    }

    const clonedDraft = await prisma.$transaction(async (tx) => {
      const newFlow = await tx.flow.create({
        data: {
          botId: activeFlow.botId,
          name: `${activeFlow.name} (Rascunho)`,
          description: activeFlow.description,
          trigger: activeFlow.trigger || 'always',
          triggerValue: activeFlow.triggerValue || null,
          isActive: false,
        },
      });

      const oldToNewStepId = new Map<string, string>();

      for (const oldStep of activeFlow.steps) {
        const createdStep = await tx.flowStep.create({
          data: {
            flowId: newFlow.id,
            intentId: oldStep.intentId,
            type: oldStep.type,
            order: oldStep.order,
            config: oldStep.config || {},
            nextStepId: null,
          },
        });
        oldToNewStepId.set(oldStep.id, createdStep.id);
      }

      for (const oldStep of activeFlow.steps) {
        const newStepId = oldToNewStepId.get(oldStep.id);
        if (!newStepId) continue;

        const mappedNextStepId =
          oldStep.nextStepId && oldStep.nextStepId !== 'END'
            ? oldToNewStepId.get(oldStep.nextStepId) || null
            : oldStep.nextStepId || null;

        await tx.flowStep.update({
          where: { id: newStepId },
          data: {
            nextStepId: mappedNextStepId,
          },
        });

        if (oldStep.response) {
          await tx.response.create({
            data: {
              flowStepId: newStepId,
              intentId: oldStep.response.intentId,
              type: oldStep.response.type,
              content: oldStep.response.content,
              buttons: oldStep.response.buttons as any,
              mediaUrl: oldStep.response.mediaUrl,
              metadata: oldStep.response.metadata as any,
              order: oldStep.response.order ?? 0,
            },
          });
        }

        for (const oldCondition of oldStep.conditions || []) {
          const mappedTrue =
            oldCondition.trueStepId && oldCondition.trueStepId !== 'END'
              ? oldToNewStepId.get(oldCondition.trueStepId) || null
              : oldCondition.trueStepId || null;
          const mappedFalse =
            oldCondition.falseStepId && oldCondition.falseStepId !== 'END'
              ? oldToNewStepId.get(oldCondition.falseStepId) || null
              : oldCondition.falseStepId || null;

          await tx.flowCondition.create({
            data: {
              stepId: newStepId,
              condition: oldCondition.condition,
              operator: oldCondition.operator,
              value: oldCondition.value,
              trueStepId: mappedTrue,
              falseStepId: mappedFalse,
              order: oldCondition.order ?? 0,
            },
          });
        }
      }

      await tx.bot.update({
        where: { id: botId },
        data: { hasPendingChanges: false },
      });

      return newFlow;
    });

    return await this.getFlowById(clonedDraft.id);
  }

  /**
   * Publica o rascunho mais recente do bot:
   * - desativa fluxos ativos atuais
   * - ativa o rascunho
   */
  async publishLatestDraftFlow(botId: string) {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: {
        id: true,
        publishedVersion: true,
      },
    });
    if (!bot) {
      throw new Error('Bot não encontrado');
    }

    const draft = await prisma.flow.findFirst({
      where: {
        botId,
        isActive: false,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!draft) {
      throw new Error('Nenhum rascunho encontrado para publicar');
    }

    await prisma.$transaction(async (tx) => {
      await tx.flow.updateMany({
        where: {
          botId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      await tx.flow.update({
        where: { id: draft.id },
        data: {
          isActive: true,
          name: draft.name.replace(/\s*\(Rascunho\)\s*$/i, ''),
        },
      });

      await tx.bot.update({
        where: { id: botId },
        data: {
          isActive: true,
          hasPendingChanges: false,
          publishedVersion: this.incrementPublishedVersion(bot.publishedVersion),
        },
      });
    });

    return await this.getBotById(botId);
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

    await this.markBotPendingByFlowId(flowId);
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
  }) {
    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.config) updateData.config = data.config;
    if (data.intentId !== undefined) updateData.intentId = data.intentId;
    if (data.nextStepId !== undefined) updateData.nextStepId = data.nextStepId;

    const step = await prisma.flowStep.update({
      where: { id: stepId },
      data: updateData,
      include: {
        response: true,
        conditions: true,
        intent: true,
      },
    });

    await this.markBotPendingByStepId(stepId);
    return step;
  }

  /**
   * Deleta um step
   */
  async deleteFlowStep(stepId: string) {
    await this.markBotPendingByStepId(stepId);
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
    const created = await prisma.flowCondition.create({
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
    await this.markBotPendingByStepId(stepId);
    return created;
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

    const existing = await prisma.flowCondition.findUnique({
      where: { id: conditionId },
      select: { stepId: true },
    });
    const updated = await prisma.flowCondition.update({
      where: { id: conditionId },
      data: updateData,
    });
    if (existing?.stepId) {
      await this.markBotPendingByStepId(existing.stepId);
    }
    return updated;
  }

  /**
   * Remove uma condição
   */
  async deleteFlowCondition(conditionId: string) {
    const existing = await prisma.flowCondition.findUnique({
      where: { id: conditionId },
      select: { stepId: true },
    });
    const deleted = await prisma.flowCondition.delete({
      where: { id: conditionId },
    });
    if (existing?.stepId) {
      await this.markBotPendingByStepId(existing.stepId);
    }
    return deleted;
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
    const fieldsThatCreateNewRevision = [
      'name',
      'description',
      'avatar',
      'language',
      'welcomeMessage',
      'fallbackMessage',
      'autoCloseEnabled',
      'autoCloseAfterMinutes',
      'autoCloseMessage',
    ];
    const changedBusinessField = fieldsThatCreateNewRevision.some(
      (field) => (data as any)[field] !== undefined,
    );
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
    if (changedBusinessField) updateData.hasPendingChanges = true;

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

