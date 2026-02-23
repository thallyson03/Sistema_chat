import prisma from '../config/database';
import { PipelineAutomationType } from '@prisma/client';
import { BotService } from './botService';
import { MessageService } from './messageService';

interface AutomationConfig {
  botId?: string;
  targetStageId?: string;
  taskTitle?: string;
  taskDescription?: string;
  delaySeconds?: number;
  // Configurações do Salesbot
  trigger?: string; // 'when_created_in_stage' | 'when_moved_to_stage' | 'when_moved_or_created' | 'when_user_changed'
  active?: string; // 'always' | 'scheduled'
  leaveUnanswered?: boolean;
  applyToExisting?: boolean;
  // Configurações de gatilhos com delay
  delayMinutes?: number; // Delay em minutos para gatilhos do pipeline
  // Configurações de gatilhos programados
  scheduledDate?: string; // Data para gatilho de tempo exato (YYYY-MM-DD)
  scheduledTime?: string; // Hora para gatilho de tempo exato (HH:mm)
  dailyTime?: string; // Hora para gatilho diário (HH:mm)
  // Configurações de tarefa
  deadline?: string;
  customDeadlineDays?: number;
  assignTo?: string;
  assignedUserId?: string;
  taskType?: string;
  [key: string]: any;
}

class PipelineAutomationService {
  private botService: BotService;
  private messageService: MessageService;

  constructor() {
    this.botService = new BotService();
    this.messageService = new MessageService();
  }

  /**
   * Busca regras de automação ativas para uma etapa específica
   */
  async getRulesForStage(stageId: string) {
    return prisma.pipelineAutomationRule.findMany({
      where: {
        stageId,
        active: true,
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Processa automações quando um deal entra em uma etapa
   * @param dealId ID do deal
   * @param stageId ID da etapa que o deal entrou
   * @param isNewDeal Se true, o deal foi recém-criado; se false, foi movido para esta etapa
   * @param triggerType Tipo de trigger que disparou a automação
   */
  async handleStageEnter(dealId: string, stageId: string, isNewDeal: boolean = false, triggerType?: string) {
    console.log(`[PipelineAutomation] Processando automações para deal ${dealId} na etapa ${stageId} (novo: ${isNewDeal})`);

    const rules = await this.getRulesForStage(stageId);
    
    if (!rules.length) {
      console.log(`[PipelineAutomation] Nenhuma regra ativa encontrada para etapa ${stageId}`);
      return;
    }

    // Buscar deal com informações necessárias
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contact: {
          include: {
            channel: true,
          },
        },
        stage: true,
        conversation: true,
      },
    });

    if (!deal || !deal.contact) {
      console.error(`[PipelineAutomation] Deal ${dealId} ou contato não encontrado`);
      return;
    }

    // Executar cada regra
    for (const rule of rules) {
      try {
        const config = (rule.config || {}) as AutomationConfig;
        
        // Verificar se o trigger corresponde
        const ruleTrigger = config.trigger || 'when_moved_to_stage';
        let shouldExecute = false;
        let delayToApply = 0;
        
        // Processar diferentes tipos de gatilho
        if (ruleTrigger.startsWith('after_')) {
          // Gatilhos com delay em minutos
          const delayMinutes = config.delayMinutes || 5;
          delayToApply = delayMinutes * 60; // Converter para segundos
          
          if (ruleTrigger.includes('created') && isNewDeal) {
            shouldExecute = true;
          } else if (ruleTrigger.includes('moved') && !isNewDeal) {
            shouldExecute = true;
          } else if (ruleTrigger.includes('moved_or_created')) {
            shouldExecute = true;
          }
        } else if (ruleTrigger === 'when_created_in_stage' && isNewDeal) {
          shouldExecute = true;
        } else if (ruleTrigger === 'when_moved_to_stage' && !isNewDeal) {
          shouldExecute = true;
        } else if (ruleTrigger === 'when_moved_or_created') {
          shouldExecute = true;
        } else if (ruleTrigger === 'when_user_changed' && triggerType === 'user_changed') {
          shouldExecute = true;
        } else if (ruleTrigger === 'exact_time' || ruleTrigger === 'daily') {
          // Gatilhos programados - verificar se é hora de executar
          shouldExecute = await this.shouldExecuteScheduledTrigger(ruleTrigger, config);
        }
        
        if (!shouldExecute) {
          console.log(`[PipelineAutomation] Regra ${rule.id} não corresponde ao trigger ${ruleTrigger}`);
          continue;
        }
        
        // Aplicar delay se configurado
        const delaySeconds = delayToApply || config.delaySeconds || 0;
        if (delaySeconds > 0) {
          console.log(`[PipelineAutomation] Aguardando ${delaySeconds} segundos antes de executar regra ${rule.id}`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }

        switch (rule.type) {
          case PipelineAutomationType.SALES_BOT:
            await this.executeSalesBotRule(rule.id, deal, config);
            break;
          case PipelineAutomationType.CHANGE_STAGE:
            await this.executeChangeStageRule(rule.id, deal, config);
            break;
          case PipelineAutomationType.ADD_TASK:
            await this.executeAddTaskRule(rule.id, deal, config);
            break;
          default:
            console.warn(`[PipelineAutomation] Tipo de automação desconhecido: ${rule.type}`);
        }
      } catch (err: any) {
        console.error(`[PipelineAutomation] Erro ao executar regra ${rule.id}:`, err.message);
        // Continuar com outras regras mesmo se uma falhar
      }
    }
  }

  /**
   * Executa regra de Robô de Vendas
   */
  private async executeSalesBotRule(
    ruleId: string,
    deal: any,
    config: AutomationConfig
  ) {
    if (!config.botId) {
      console.warn(`[PipelineAutomation] Regra ${ruleId}: botId não configurado`);
      return;
    }

    console.log(`[PipelineAutomation] Executando SALES_BOT: iniciando bot ${config.botId} para contato ${deal.contactId}`);

    // Verificar se há conversa associada ao deal
    if (!deal.conversationId) {
      console.warn(`[PipelineAutomation] Deal ${deal.id} não tem conversa associada. Criando conversa...`);
      
      // Buscar ou criar conversa para o contato
      let conversation = await prisma.conversation.findFirst({
        where: {
          contactId: deal.contactId,
          channelId: deal.contact.channelId,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            contactId: deal.contactId,
            channelId: deal.contact.channelId,
            status: 'OPEN',
          },
        });

        // Atualizar deal com a conversa criada
        await prisma.deal.update({
          where: { id: deal.id },
          data: { conversationId: conversation.id },
        });
      }
    }

    // Verificar se o bot existe e está ativo
    const bot = await prisma.bot.findUnique({
      where: { id: config.botId },
    });

    if (!bot || !bot.isActive) {
      console.error(`[PipelineAutomation] Bot ${config.botId} não encontrado ou inativo`);
      return;
    }

    // Verificar se o bot pertence ao mesmo canal do contato
    if (bot.channelId !== deal.contact.channelId) {
      console.error(`[PipelineAutomation] Bot ${config.botId} não pertence ao canal do contato`);
      return;
    }

    // Criar ou ativar sessão do bot
    let conversationId = deal.conversationId;
    
    // Se não há conversa no deal, buscar a primeira conversa do contato
    if (!conversationId) {
      const firstConversation = await prisma.conversation.findFirst({
        where: {
          contactId: deal.contactId,
          channelId: deal.contact.channelId,
        },
        orderBy: { createdAt: 'desc' },
      });
      conversationId = firstConversation?.id;
    }
    
    if (!conversationId) {
      console.error(`[PipelineAutomation] Não foi possível encontrar conversa para iniciar o bot`);
      return;
    }

    // Verificar se já existe sessão ativa
    let botSession = await prisma.botSession.findUnique({
      where: { conversationId },
    });

    if (!botSession) {
      // Criar nova sessão
      botSession = await prisma.botSession.create({
        data: {
          botId: config.botId,
          conversationId,
          isActive: true,
          context: {
            dealId: deal.id,
            dealName: deal.name,
            contactName: deal.contact.name,
          },
        },
      });
    } else {
      // Atualizar sessão existente
      await prisma.botSession.update({
        where: { id: botSession.id },
        data: {
          botId: config.botId,
          isActive: true,
          context: {
            ...(botSession.context as any || {}),
            dealId: deal.id,
            dealName: deal.name,
            contactName: deal.contact.name,
          },
        },
      });
    }

    // Enviar mensagem de boas-vindas do bot se configurado
    if (bot.welcomeMessage) {
      try {
        // Buscar um usuário admin para usar como remetente da mensagem automática
        const systemUser = await prisma.user.findFirst({
          where: { role: 'ADMIN', isActive: true },
        });

        if (systemUser) {
          await this.messageService.sendMessage({
            conversationId,
            userId: systemUser.id,
            content: bot.welcomeMessage,
            type: 'TEXT',
          });
        } else {
          console.warn(`[PipelineAutomation] Nenhum usuário admin encontrado para enviar mensagem de boas-vindas`);
        }
      } catch (err: any) {
        console.error(`[PipelineAutomation] Erro ao enviar mensagem de boas-vindas:`, err.message);
      }
    }

    console.log(`[PipelineAutomation] Bot ${config.botId} iniciado com sucesso para deal ${deal.id}`);
  }

  /**
   * Verifica se um gatilho programado deve ser executado
   */
  private async shouldExecuteScheduledTrigger(trigger: string, config: AutomationConfig): Promise<boolean> {
    if (trigger === 'exact_time') {
      if (!config.scheduledDate || !config.scheduledTime) {
        return false;
      }
      
      const scheduledDateTime = new Date(`${config.scheduledDate}T${config.scheduledTime}`);
      const now = new Date();
      
      // Executar se já passou do horário agendado
      return now >= scheduledDateTime;
    } else if (trigger === 'daily') {
      if (!config.dailyTime) {
        return false;
      }
      
      const [hours, minutes] = config.dailyTime.split(':').map(Number);
      const now = new Date();
      const todayScheduled = new Date();
      todayScheduled.setHours(hours, minutes, 0, 0);
      
      // Executar se já passou do horário de hoje
      return now >= todayScheduled;
    }
    
    return false;
  }

  /**
   * Executa regra de Mudar Etapa
   */
  private async executeChangeStageRule(
    ruleId: string,
    deal: any,
    config: AutomationConfig
  ) {
    if (!config.targetStageId) {
      console.warn(`[PipelineAutomation] Regra ${ruleId}: targetStageId não configurado`);
      return;
    }

    // Verificar se a etapa alvo é diferente da atual
    if (config.targetStageId === deal.stageId) {
      console.log(`[PipelineAutomation] Deal ${deal.id} já está na etapa alvo ${config.targetStageId}`);
      return;
    }

    console.log(`[PipelineAutomation] Executando CHANGE_STAGE: movendo deal ${deal.id} para etapa ${config.targetStageId}`);

    // Verificar se a etapa alvo existe e pertence ao mesmo pipeline
    const targetStage = await prisma.pipelineStage.findUnique({
      where: { id: config.targetStageId },
    });

    if (!targetStage) {
      console.error(`[PipelineAutomation] Etapa alvo ${config.targetStageId} não encontrada`);
      return;
    }

    if (targetStage.pipelineId !== deal.pipelineId) {
      console.error(`[PipelineAutomation] Etapa alvo ${config.targetStageId} não pertence ao mesmo pipeline`);
      return;
    }

    // Importar DealService para evitar dependência circular
    const { DealService } = await import('./dealService');
    const dealService = new DealService();

    // Mover deal para a nova etapa (sem disparar automações novamente para evitar loop)
    await dealService.moveDealToStage(deal.id, config.targetStageId);

    console.log(`[PipelineAutomation] Deal ${deal.id} movido automaticamente para etapa ${targetStage.name}`);
  }

  /**
   * Executa regra de Adicionar Tarefa
   */
  private async executeAddTaskRule(
    ruleId: string,
    deal: any,
    config: AutomationConfig
  ) {
    if (!config.taskTitle) {
      console.warn(`[PipelineAutomation] Regra ${ruleId}: taskTitle não configurado`);
      return;
    }

    console.log(`[PipelineAutomation] Executando ADD_TASK: criando tarefa para deal ${deal.id}`);

    // Calcular data de vencimento baseado no prazo configurado
    let dueDate: Date | null = null;
    const deadline = config.deadline || 'immediately';
    
    if (deadline !== 'immediately') {
      let daysToAdd = 0;
      
      switch (deadline) {
        case '1_day':
          daysToAdd = 1;
          break;
        case '2_days':
          daysToAdd = 2;
          break;
        case '3_days':
          daysToAdd = 3;
          break;
        case '5_days':
          daysToAdd = 5;
          break;
        case '7_days':
          daysToAdd = 7;
          break;
        case 'custom':
          daysToAdd = config.customDeadlineDays || 0;
          break;
      }
      
      if (daysToAdd > 0) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysToAdd);
      }
    }

    // Determinar usuário responsável
    let assignedUserId: string | null = null;
    const assignTo = config.assignTo || 'current_user';
    
    if (assignTo === 'current_user' && deal.assignedToId) {
      assignedUserId = deal.assignedToId;
    } else if (assignTo === 'specific_user' && config.assignedUserId) {
      assignedUserId = config.assignedUserId;
    }

    // Criar tarefa
    await prisma.pipelineTask.create({
      data: {
        dealId: deal.id,
        title: config.taskTitle,
        description: config.taskDescription || null,
        dueDate,
        status: 'PENDING',
        // Armazenar tipo de tarefa e outros metadados no description ou criar campo separado
        // Por enquanto, vamos incluir no description
        ...(config.taskType ? {
          description: `${config.taskDescription || ''}\n[Tipo: ${config.taskType}]`.trim(),
        } : {}),
      },
    });

    console.log(`[PipelineAutomation] Tarefa criada com sucesso para deal ${deal.id}`, {
      title: config.taskTitle,
      type: config.taskType,
      dueDate,
      assignedTo: assignedUserId || 'N/A',
    });
  }

  /**
   * Salva regras de automação para um pipeline
   */
  async saveAutomationRules(pipelineId: string, rules: Array<{
    id?: string;
    stageId: string;
    type: PipelineAutomationType;
    name: string;
    config: AutomationConfig;
    active?: boolean;
  }>) {
    // Estratégia: deletar todas as regras existentes e recriar
    // (pode ser otimizado para fazer upsert, mas esta abordagem é mais simples)
    await prisma.pipelineAutomationRule.deleteMany({
      where: { pipelineId },
    });

    const createdRules = [];
    for (const rule of rules) {
      const created = await prisma.pipelineAutomationRule.create({
        data: {
          pipelineId,
          stageId: rule.stageId,
          type: rule.type,
          name: rule.name,
          config: rule.config || {},
          active: rule.active !== undefined ? rule.active : true,
        },
      });
      createdRules.push(created);
    }

    return createdRules;
  }

  /**
   * Busca todas as regras de automação de um pipeline
   */
  async getAutomationRules(pipelineId: string) {
    return prisma.pipelineAutomationRule.findMany({
      where: { pipelineId },
      include: {
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

export const pipelineAutomationService = new PipelineAutomationService();

