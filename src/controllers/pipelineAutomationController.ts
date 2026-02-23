import { Request, Response } from 'express';
import { pipelineAutomationService } from '../services/pipelineAutomationService';
import { PipelineAutomationType } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

export class PipelineAutomationController {
  /**
   * Salva regras de automação para um pipeline
   */
  async saveAutomations(req: AuthRequest, res: Response) {
    try {
      const { id: pipelineId } = req.params;
      const { rules } = req.body;

      if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'rules deve ser um array' });
      }

      // Validar e transformar regras
      const validatedRules = rules.map((rule: any) => {
        // Mapear tipos do frontend para o enum do Prisma
        let automationType: PipelineAutomationType;
        if (rule.type === 'sales_bot' || rule.type === 'SALES_BOT') {
          automationType = PipelineAutomationType.SALES_BOT;
        } else if (rule.type === 'change_stage' || rule.type === 'CHANGE_STAGE') {
          automationType = PipelineAutomationType.CHANGE_STAGE;
        } else if (rule.type === 'add_task' || rule.type === 'ADD_TASK') {
          automationType = PipelineAutomationType.ADD_TASK;
        } else {
          throw new Error(`Tipo de automação inválido: ${rule.type}`);
        }

        return {
          id: rule.id?.startsWith('block_') ? undefined : rule.id, // IDs temporários não são salvos
          stageId: rule.stageId,
          type: automationType,
          name: rule.name || this.getDefaultName(automationType),
          config: rule.config || {},
          active: rule.active !== undefined ? rule.active : true,
        };
      });

      const savedRules = await pipelineAutomationService.saveAutomationRules(
        pipelineId,
        validatedRules
      );

      console.log(`[PipelineAutomationController] ${savedRules.length} regras salvas para pipeline ${pipelineId}`);

      res.json({ rules: savedRules });
    } catch (error: any) {
      console.error('[PipelineAutomationController] Erro ao salvar automações:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca regras de automação de um pipeline
   */
  async getAutomations(req: AuthRequest, res: Response) {
    try {
      const { id: pipelineId } = req.params;

      const rules = await pipelineAutomationService.getAutomationRules(pipelineId);

      // Transformar para formato do frontend
      const formattedRules = rules.map((rule) => ({
        id: rule.id,
        stageId: rule.stageId,
        type: this.mapTypeToFrontend(rule.type),
        name: rule.name,
        config: rule.config,
        active: rule.active,
      }));

      res.json({ rules: formattedRules });
    } catch (error: any) {
      console.error('[PipelineAutomationController] Erro ao buscar automações:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mapeia tipo do Prisma para formato do frontend
   */
  private mapTypeToFrontend(type: PipelineAutomationType): string {
    switch (type) {
      case PipelineAutomationType.SALES_BOT:
        return 'sales_bot';
      case PipelineAutomationType.CHANGE_STAGE:
        return 'change_stage';
      case PipelineAutomationType.ADD_TASK:
        return 'add_task';
    }
  }

  /**
   * Retorna nome padrão para tipo de automação
   */
  private getDefaultName(type: PipelineAutomationType): string {
    switch (type) {
      case PipelineAutomationType.SALES_BOT:
        return 'Robô de vendas';
      case PipelineAutomationType.CHANGE_STAGE:
        return 'Mudar etapa';
      case PipelineAutomationType.ADD_TASK:
        return 'Adicionar tarefa';
      default:
        return 'Automação';
    }
  }
}

