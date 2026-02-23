import prisma from '../config/database';
import { MessageService } from './messageService';
import { BotVariableService } from './botVariableService';

export interface CreateBotData {
  name: string;
  description?: string;
  avatar?: string;
  channelId: string;
  language?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
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
    const bot = await prisma.bot.create({
      data: {
        name: data.name,
        description: data.description,
        avatar: data.avatar,
        channelId: data.channelId,
        language: data.language || 'pt-BR',
        welcomeMessage: data.welcomeMessage,
        fallbackMessage: data.fallbackMessage || 'Desculpe, não entendi. Pode reformular sua pergunta?',
        isActive: true,
      },
    });

    console.log('[BotService] Bot criado:', bot.id);
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
   */
  async processMessage(messageContent: string, conversationId: string) {
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

    // Verificar se há bot ativo para este canal
    if (!conversation.channelId) {
      console.log('[BotService] Conversa não possui canal associado, não há bot para processar');
      return null;
    }

    const bot = await prisma.bot.findFirst({
      where: {
        channelId: conversation.channelId,
        isActive: true,
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

    if (!bot) {
      return null; // Nenhum bot ativo
    }

    // Se já existe sessão ativa, usar ela; senão criar nova
    // Usar tipo any para evitar problemas de tipo com bot incluído ou não
    let session: any = null;
    
    if (conversation.botSession) {
      session = conversation.botSession as any;
    } else {
      // Criar nova sessão sem incluir bot
      // Fazer o cast direto no await para evitar problemas de tipo
      session = (await prisma.botSession.create({
        data: {
          botId: bot.id,
          conversationId: conversation.id,
          isActive: true,
          context: {},
        },
      })) as any;
    }

    // Tentar fazer match de intent
    const matchedIntent = await this.matchIntent(messageContent, bot.id);

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
        await this.executeFlow(flow, session as any, messageContent);
        return { flow: flow.id };
      }
    }

    // Se não há fluxo ativo, verificar se há fluxo com trigger "always" para iniciar automaticamente
    if (session && !(session as any).currentFlowId) {
      // Buscar fluxo com trigger "always" ou sem trigger específico (fluxo padrão)
      const alwaysFlow = (bot as any).flows?.find((f: any) => 
        f.isActive && 
        (f.trigger === 'always' || !f.trigger || f.trigger === '')
      );
      
      if (alwaysFlow) {
        console.log(`[BotService] Iniciando fluxo automático "${alwaysFlow.name}" (trigger: ${alwaysFlow.trigger || 'always'})`);
        
        // Atualizar sessão com o fluxo ativo
        const firstStep = alwaysFlow.steps?.find((s: any) => s.order === 0) || alwaysFlow.steps?.[0];
        
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
          await this.executeFlow(alwaysFlow, updatedSession as any, '');
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
   * Executa um fluxo
   */
  async executeFlow(flow: any, session: any, input: string) {
    console.log(`[BotService] Executando fluxo "${flow.name}", step atual: ${session.currentStepId || 'nenhum'}`);
    
    // Implementação básica - pode ser expandida
    const currentStep = flow.steps.find((s: any) => s.id === session.currentStepId) || flow.steps[0];

    if (!currentStep) {
      console.warn(`[BotService] Nenhum step encontrado no fluxo "${flow.name}"`);
      return;
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
        // Avançar para próximo step automaticamente se houver
        if (currentStep.nextStepId) {
          // Se nextStepId é "END", finalizar fluxo
          if (currentStep.nextStepId === 'END') {
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
                currentStepId: currentStep.nextStepId,
              },
            });
            
            // Executar próximo step automaticamente se for MESSAGE
            // Se for INPUT, apenas atualizar o currentStepId e aguardar resposta do usuário
            const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
            if (nextStep) {
              if (nextStep.type === 'MESSAGE') {
                // Executar próximo step MESSAGE automaticamente
                const updatedSession = {
                  ...session,
                  currentStepId: currentStep.nextStepId,
                };
                await this.executeFlow(flow, updatedSession, input);
              } else if (nextStep.type === 'INPUT' || nextStep.type === 'TEXT_INPUT' || nextStep.type === 'EMAIL_INPUT' || nextStep.type === 'NUMBER_INPUT' || nextStep.type === 'PHONE_INPUT') {
                // Para steps INPUT, apenas atualizar o currentStepId e aguardar resposta do usuário
                // Não executar automaticamente - o próximo processMessage vai processar o INPUT
                console.log(`[BotService] Aguardando input do usuário no step ${nextStep.id} (tipo: ${nextStep.type})`);
                // currentStepId já foi atualizado acima, então o próximo processMessage vai processar o INPUT
              } else {
                // Para outros tipos, executar automaticamente
                const updatedSession = {
                  ...session,
                  currentStepId: currentStep.nextStepId,
                };
                await this.executeFlow(flow, updatedSession, input);
              }
            }
          }
        } else {
          // Se não há próximo step, finalizar fluxo
          console.log(`[BotService] Fluxo "${flow.name}" finalizado (sem próximo step)`);
          await prisma.botSession.update({
            where: { id: session.id },
            data: {
              currentFlowId: null,
              currentStepId: null,
            },
          });
        }
        break;

      case 'HANDOFF':
        await this.handoffToHuman(session.id, currentStep.config?.userId);
        break;

      case 'CONDITION':
        // Processar condições
        const condition = currentStep.conditions[0];
        if (condition) {
          const result = this.evaluateCondition(condition, input, session.context || {});
          const nextStepId = result ? condition.trueStepId : condition.falseStepId;

          if (nextStepId) {
            await prisma.botSession.update({
              where: { id: session.id },
              data: {
                currentStepId: nextStepId,
              },
            });
          }
        }
        break;

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
              // Atualizar para próximo step e executar se for MESSAGE
              await prisma.botSession.update({
                where: { id: session.id },
                data: {
                  currentStepId: currentStep.nextStepId,
                },
              });
              
              // Executar próximo step se for MESSAGE
              const nextStep = flow.steps.find((s: any) => s.id === currentStep.nextStepId);
              if (nextStep && nextStep.type === 'MESSAGE') {
                const updatedSession = {
                  ...session,
                  currentStepId: currentStep.nextStepId,
                  context: updatedContext,
                };
                await this.executeFlow(flow, updatedSession, input);
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
      case 'HTTP_REQUEST':
        // Fazer chamada HTTP e salvar resultado em variável
        const httpConfig = currentStep.config;
        if (httpConfig?.url) {
          try {
            const response = await this.executeHttpRequest(httpConfig, (session.context as Record<string, any>) || {});
            let updatedContext = { ...(session.context as Record<string, any>) || {} };
            
            // Salvar resposta completa em variável se especificado
            if (httpConfig.variableName) {
              updatedContext = this.variableService.setVariableValue(
                updatedContext,
                httpConfig.variableName,
                response
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
                      fieldValue
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
            
            // Enviar mensagem com o resultado (opcional)
            if (httpConfig.showResponse) {
              const responseMessage = typeof response === 'object' 
                ? JSON.stringify(response, null, 2)
                : String(response);
              await this.sendBotResponse(session.conversationId, {
                type: 'TEXT',
                content: `Resposta da API:\n${responseMessage}`,
              } as any, session.botId, updatedContext);
            }
          } catch (error: any) {
            console.error('[BotService] Erro ao executar HTTP Request:', error);
            const errorMessage = httpConfig.errorMessage || `Erro ao chamar API: ${error.message}`;
            await this.sendBotResponse(session.conversationId, {
              type: 'TEXT',
              content: errorMessage,
            } as any, session.botId, (session.context as Record<string, any>) || {});
          }
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
        break;

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
          const errorMsg = currentStep.config?.errorMessage || 'Resposta inválida. Por favor, tente novamente.';
          await this.sendBotResponse(session.conversationId, {
            type: 'TEXT',
            content: errorMsg,
          } as any, session.botId, inputContext);
        }
        break;

      case 'PICTURE_CHOICE':
        // Aguardar escolha de imagem
        const choiceContext = (session.context as Record<string, any>) || {};
        const choiceVariableName = currentStep.config?.variableName;
        if (choiceVariableName && input) {
          const updatedChoiceContext = this.variableService.setVariableValue(choiceContext, choiceVariableName, input);
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
        }
        break;

      case 'REDIRECT':
        // Redirecionamento é tratado no frontend/cliente
        // Aqui apenas avançamos o fluxo
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'SCRIPT':
        // Executar script JavaScript (em ambiente seguro)
        // Por segurança, scripts são executados apenas no frontend
        // Aqui apenas avançamos o fluxo
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

      case 'WAIT':
        // Aguardar evento específico (implementação depende do tipo de wait)
        // Por enquanto, apenas avançamos após delay
        const waitTime = currentStep.config?.waitTime || 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        if (currentStep.nextStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: currentStep.nextStepId },
          });
        }
        break;

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

      case 'JUMP':
        // Pular para step específico
        const targetStepId = currentStep.config?.targetStepId;
        if (targetStepId) {
          await prisma.botSession.update({
            where: { id: session.id },
            data: { currentStepId: targetStepId },
          });
        }
        break;

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
    const validation = step.config?.validation;
    if (!validation) return true;

    const inputType = step.config?.inputType || 'TEXT';

    // Validação de obrigatório
    if (validation.required && (!userInput || !userInput.trim())) {
      return false;
    }

    // Validações específicas por tipo
    if (inputType === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userInput)) {
        return false;
      }
    }

    if (inputType === 'PHONE') {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(userInput)) {
        return false;
      }
    }

    if (inputType === 'NUMBER') {
      const num = Number(userInput);
      if (isNaN(num)) {
        return false;
      }
      if (validation.min !== undefined && num < validation.min) {
        return false;
      }
      if (validation.max !== undefined && num > validation.max) {
        return false;
      }
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
   * Avalia uma condição
   */
  private evaluateCondition(condition: any, input: string, context: any): boolean {
    let value: any;

    // Obter valor baseado no campo
    if (condition.condition.startsWith('context.')) {
      const key = condition.condition.replace('context.', '');
      value = context[key];
    } else if (condition.condition === 'message.content') {
      value = input;
    } else {
      value = input;
    }

    // Comparar baseado no operador
    switch (condition.operator) {
      case 'EQUALS':
        return String(value) === condition.value;
      case 'CONTAINS':
        return String(value).toLowerCase().includes(condition.value.toLowerCase());
      case 'GREATER_THAN':
        return Number(value) > Number(condition.value);
      case 'LESS_THAN':
        return Number(value) < Number(condition.value);
      case 'REGEX':
        try {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(String(value));
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
        userId: '', // Bot não tem userId
        content,
        type: response.type || 'TEXT',
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
   * Cria uma condição para um step
   */
  async createFlowCondition(stepId: string, data: {
    condition: string;
    operator: string;
    value: string;
    trueStepId?: string;
    falseStepId?: string;
  }) {
    // Verificar se já existe uma condição para este step
    const existingCondition = await prisma.flowCondition.findFirst({
      where: { stepId },
    });

    if (existingCondition) {
      // Atualizar condição existente
      const condition = await prisma.flowCondition.update({
        where: { id: existingCondition.id },
        data: {
          condition: data.condition,
          operator: data.operator,
          value: data.value,
          trueStepId: data.trueStepId !== undefined ? data.trueStepId : existingCondition.trueStepId,
          falseStepId: data.falseStepId !== undefined ? data.falseStepId : existingCondition.falseStepId,
        },
      });
      return condition;
    } else {
      // Criar nova condição
      const condition = await prisma.flowCondition.create({
        data: {
          stepId,
          condition: data.condition,
          operator: data.operator,
          value: data.value,
          trueStepId: data.trueStepId,
          falseStepId: data.falseStepId,
        },
      });
      return condition;
    }
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
  }) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.language) updateData.language = data.language;
    if (data.welcomeMessage !== undefined) updateData.welcomeMessage = data.welcomeMessage;
    if (data.fallbackMessage !== undefined) updateData.fallbackMessage = data.fallbackMessage;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

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
}

