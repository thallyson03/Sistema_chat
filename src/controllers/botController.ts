import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BotService } from '../services/botService';
import { BotVariableService } from '../services/botVariableService';
import prisma from '../config/database';

const botService = new BotService();
const botVariableService = new BotVariableService();

export class BotController {
  /**
   * Cria um novo bot
   */
  async createBot(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas ADMIN e SUPERVISOR podem criar bots
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar bots' });
      }

      const { name, description, avatar, channelId, language, welcomeMessage, fallbackMessage } = req.body;

      if (!name || !channelId) {
        return res.status(400).json({ error: 'Nome e channelId são obrigatórios' });
      }

      const bot = await botService.createBot({
        name,
        description,
        avatar,
        channelId,
        language,
        welcomeMessage,
        fallbackMessage,
      });

      res.status(201).json(bot);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar bot:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Lista bots
   */
  async listBots(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { channelId, isActive } = req.query;

      const bots = await botService.listBots(
        channelId as string | undefined,
        isActive === 'true' ? true : isActive === 'false' ? false : undefined
      );

      res.json(bots);
    } catch (error: any) {
      console.error('[BotController] Erro ao listar bots:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtém um bot por ID
   */
  async getBot(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;

      const bot = await botService.getBotById(id);

      if (!bot) {
        return res.status(404).json({ error: 'Bot não encontrado' });
      }

      res.json(bot);
    } catch (error: any) {
      console.error('[BotController] Erro ao obter bot:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Atualiza um bot
   */
  async updateBot(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem atualizar bots' });
      }

      const { id } = req.params;
      const { name, description, avatar, language, welcomeMessage, fallbackMessage, isActive } = req.body;

      const bot = await botService.updateBot(id, {
        name,
        description,
        avatar,
        language,
        welcomeMessage,
        fallbackMessage,
        isActive,
      });

      res.json(bot);
    } catch (error: any) {
      console.error('[BotController] Erro ao atualizar bot:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deleta um bot
   */
  async deleteBot(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar bots' });
      }

      const { id } = req.params;

      await botService.deleteBot(id);

      res.json({ message: 'Bot deletado com sucesso' });
    } catch (error: any) {
      console.error('[BotController] Erro ao deletar bot:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Cria uma intent
   */
  async createIntent(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar intents' });
      }

      const { botId, name, keywords, patterns, priority } = req.body;

      if (!botId || !name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'botId, name e keywords são obrigatórios' });
      }

      const intent = await botService.createIntent({
        botId,
        name,
        keywords,
        patterns,
        priority,
      });

      res.status(201).json(intent);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar intent:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Lista intents de um bot
   */
  async listIntents(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { botId } = req.params;

      const bot = await botService.getBotById(botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot não encontrado' });
      }

      res.json(bot.intents);
    } catch (error: any) {
      console.error('[BotController] Erro ao listar intents:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cria uma resposta
   */
  async createResponse(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar respostas' });
      }

      const { intentId, flowStepId, type, content, buttons, mediaUrl, metadata, order } = req.body;

      if (!type || !content) {
        return res.status(400).json({ error: 'type e content são obrigatórios' });
      }

      if (!intentId && !flowStepId) {
        return res.status(400).json({ error: 'intentId ou flowStepId é obrigatório' });
      }

      const response = await botService.createResponse({
        intentId,
        flowStepId,
        type,
        content,
        buttons,
        mediaUrl,
        metadata,
        order,
      });

      res.status(201).json(response);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar resposta:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Cria um fluxo
   */
  async createFlow(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar fluxos' });
      }

      const { botId } = req.params;
      const { name, description, trigger, triggerValue } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }

      const flow = await botService.createFlow({
        botId,
        name,
        description,
        trigger: trigger || 'always',
        triggerValue,
      });

      res.status(201).json(flow);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar fluxo:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Lista fluxos de um bot
   */
  async listFlows(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { botId } = req.params;

      const bot = await botService.getBotById(botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot não encontrado' });
      }

      res.json(bot.flows);
    } catch (error: any) {
      console.error('[BotController] Erro ao listar fluxos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Atualiza um fluxo
   */
  async updateFlow(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem atualizar fluxos' });
      }

      const { flowId } = req.params;
      const { name, description, trigger, triggerValue, isActive } = req.body;

      // Implementar atualização no service (por enquanto retornar mensagem)
      res.json({ message: 'Atualização de fluxo (implementar no service)' });
    } catch (error: any) {
      console.error('[BotController] Erro ao atualizar fluxo:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deleta um fluxo
   */
  async deleteFlow(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem deletar fluxos' });
      }

      const { flowId } = req.params;

      // Implementar deleção no service
      await prisma.flow.delete({
        where: { id: flowId },
      });

      res.json({ message: 'Fluxo deletado com sucesso' });
    } catch (error: any) {
      console.error('[BotController] Erro ao deletar fluxo:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Testa um bot (simula uma mensagem)
   */
  async testBot(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
      }

      // Buscar bot
      const bot = await botService.getBotById(id);
      if (!bot) {
        return res.status(404).json({ error: 'Bot não encontrado' });
      }

      // Fazer match de intent
      const matchedIntent = await botService.matchIntent(message, id);

      res.json({
        message,
        matchedIntent: matchedIntent ? {
          id: matchedIntent.id,
          name: matchedIntent.name,
          keywords: matchedIntent.keywords,
        } : null,
        responses: matchedIntent?.responses || [],
      });
    } catch (error: any) {
      console.error('[BotController] Erro ao testar bot:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtém um fluxo por ID
   */
  async getFlow(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { flowId } = req.params;

      const flow = await botService.getFlowById(flowId);

      if (!flow) {
        return res.status(404).json({ error: 'Fluxo não encontrado' });
      }

      res.json(flow);
    } catch (error: any) {
      console.error('[BotController] Erro ao obter fluxo:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cria um step em um fluxo
   */
  async createFlowStep(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar steps' });
      }

      const { flowId } = req.params;
      const { type, order, config, intentId, responseId, nextStepId } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Tipo do step é obrigatório' });
      }

      const step = await botService.createFlowStep(flowId, {
        type,
        order: order || 0,
        config,
        intentId,
        responseId,
        nextStepId,
      });

      res.status(201).json(step);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar step:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Atualiza um step
   */
  async updateFlowStep(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem atualizar steps' });
      }

      const { stepId } = req.params;
      const { type, order, config, intentId, nextStepId, responseId } = req.body;

      const step = await botService.updateFlowStep(stepId, {
        type,
        order,
        config,
        intentId,
        nextStepId,
        responseId,
      });

      res.json(step);
    } catch (error: any) {
      console.error('[BotController] Erro ao atualizar step:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deleta um step
   */
  async deleteFlowStep(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem deletar steps' });
      }

      const { stepId } = req.params;

      await botService.deleteFlowStep(stepId);

      res.json({ message: 'Step deletado com sucesso' });
    } catch (error: any) {
      console.error('[BotController] Erro ao deletar step:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Cria uma condição para um step
   */
  async createFlowCondition(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar condições' });
      }

      const { stepId } = req.params;
      const { condition, operator, value, trueStepId, falseStepId } = req.body;

      if (!condition || !operator || value === undefined) {
        return res.status(400).json({ error: 'condition, operator e value são obrigatórios' });
      }

      const flowCondition = await botService.createFlowCondition(stepId, {
        condition,
        operator,
        value,
        trueStepId,
        falseStepId,
      });

      res.status(201).json(flowCondition);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar condição:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Cria uma nova variável
   */
  async createVariable(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem criar variáveis' });
      }

      const { botId, name, type, defaultValue, isGlobal, description } = req.body;

      if (!botId || !name || !type) {
        return res.status(400).json({ error: 'botId, name e type são obrigatórios' });
      }

      const variable = await botVariableService.createVariable({
        botId,
        name,
        type,
        defaultValue,
        isGlobal,
        description,
      });

      res.status(201).json(variable);
    } catch (error: any) {
      console.error('[BotController] Erro ao criar variável:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Lista todas as variáveis de um bot
   */
  async listVariables(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { botId } = req.params;

      if (!botId) {
        return res.status(400).json({ error: 'botId é obrigatório' });
      }

      const variables = await botVariableService.listVariables(botId);

      res.json(variables);
    } catch (error: any) {
      console.error('[BotController] Erro ao listar variáveis:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Atualiza uma variável
   */
  async updateVariable(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem atualizar variáveis' });
      }

      const { id } = req.params;
      const { name, type, defaultValue, isGlobal, description } = req.body;

      const variable = await botVariableService.updateVariable(id, {
        name,
        type,
        defaultValue,
        isGlobal,
        description,
      });

      res.json(variable);
    } catch (error: any) {
      console.error('[BotController] Erro ao atualizar variável:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deleta uma variável
   */
  async deleteVariable(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Apenas administradores e supervisores podem deletar variáveis' });
      }

      const { id } = req.params;

      await botVariableService.deleteVariable(id);

      res.json({ message: 'Variável deletada com sucesso' });
    } catch (error: any) {
      console.error('[BotController] Erro ao deletar variável:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

