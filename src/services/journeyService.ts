import prisma from '../config/database';
import { JourneyStatus, JourneyNodeType } from '@prisma/client';

export interface JourneyNodeInput {
  id?: string;
  type: JourneyNodeType;
  label: string;
  config?: any;
  positionX: number;
  positionY: number;
}

export interface JourneyEdgeInput {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: any;
}

export interface JourneyGraphInput {
  nodes: JourneyNodeInput[];
  edges: JourneyEdgeInput[];
}

export class JourneyService {
  async createJourney(data: { name: string; description?: string }) {
    const journey = await prisma.journey.create({
      data: {
        name: data.name,
        description: data.description || null,
      },
    });

    return journey;
  }

  async getJourneys() {
    return prisma.journey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getJourneyById(id: string) {
    const journey = await prisma.journey.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        edges: true,
      },
    });

    // Log para debug - verificar se config está sendo retornado
    if (journey) {
      journey.nodes.forEach((node: any) => {
        if (node.type === 'ACTION') {
          console.log(`[JourneyService] Nó ACTION ${node.id} do banco:`, {
            label: node.label,
            config: node.config,
            configType: typeof node.config,
            configString: JSON.stringify(node.config),
          });
        }
      });
    }

    return journey;
  }

  /**
   * Busca estatísticas de uma jornada
   */
  async getJourneyStats(journeyId: string) {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        nodes: {
          where: { type: 'TRIGGER' },
        },
      },
    });

    if (!journey) {
      throw new Error('Jornada não encontrada');
    }

    const triggerNode = journey.nodes[0];
    const triggerConfig = (triggerNode?.config as any) || {};

    // Se o trigger for "list_added", buscar total de contatos na lista
    let totalContacts = 0;
    if (triggerConfig.triggerType === 'list_added' && triggerConfig.listId) {
      const list = await prisma.contactList.findUnique({
        where: { id: triggerConfig.listId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });
      totalContacts = list?._count.members || 0;
    }

    // Buscar estatísticas de execução
    const executions = await (prisma as any).journeyExecution.findMany({
      where: { journeyId },
      select: {
        status: true,
        messagesSent: true,
      },
    });

    const totalExecutions = executions.length;
    const completed = executions.filter((e: any) => e.status === 'COMPLETED').length;
    const failed = executions.filter((e: any) => e.status === 'FAILED').length;
    const pending = executions.filter((e: any) => e.status === 'PENDING' || e.status === 'IN_PROGRESS').length;
    const totalMessagesSent = executions.reduce((sum: number, e: any) => sum + e.messagesSent, 0);

    return {
      totalContacts: totalContacts || totalExecutions,
      totalExecutions,
      completed,
      failed,
      pending,
      totalMessagesSent,
      successRate: totalExecutions > 0 ? (completed / totalExecutions) * 100 : 0,
    };
  }

  async updateJourney(id: string, data: Partial<{ name: string; description?: string; status?: JourneyStatus }>) {
    const journey = await prisma.journey.update({
      where: { id },
      data,
    });

    // Se a jornada foi ativada, verificar se precisa executar para contatos existentes
    if (data.status === 'ACTIVE') {
      // Buscar nós do trigger separadamente
      const triggerNodes = await prisma.journeyNode.findMany({
        where: {
          journeyId: id,
          type: 'TRIGGER',
        },
      });

      for (const triggerNode of triggerNodes) {
        // Garantir que config seja um objeto
        let triggerConfig = triggerNode.config as any || {};
        if (typeof triggerConfig === 'string') {
          try {
            triggerConfig = JSON.parse(triggerConfig);
          } catch (e) {
            console.warn(`[JourneyService] Erro ao parsear config do trigger:`, e);
            triggerConfig = {};
          }
        }

        if (triggerConfig?.triggerType === 'list_added' && triggerConfig?.includeExistingContacts && triggerConfig?.listId) {
          console.log(`[JourneyService] Jornada ${id} ativada com includeExistingContacts. Executando para contatos existentes da lista ${triggerConfig.listId}...`);
          
          // Importar e executar para todos os contatos da lista
          const { JourneyExecutionService } = await import('./journeyExecutionService');
          const journeyExecutionService = new JourneyExecutionService();
          
          try {
            // Executar de forma assíncrona para não bloquear a resposta
            journeyExecutionService.executeJourneyForAllContactsInList(id, triggerConfig.listId).catch((error: any) => {
              console.error(`[JourneyService] Erro ao executar jornada para contatos existentes:`, error);
            });
          } catch (error: any) {
            console.error(`[JourneyService] Erro ao iniciar execução para contatos existentes:`, error);
            // Não bloquear a ativação se houver erro
          }
        }
      }
    }

    return journey;
  }

  async deleteJourney(id: string) {
    await prisma.journey.delete({
      where: { id },
    });
  }

  /**
   * Atualiza o grafo (nós e conexões) de uma jornada.
   * Estratégia simples: substituir nós e edges atuais pelos novos.
   */
  async updateJourneyGraph(journeyId: string, graph: JourneyGraphInput) {
    // Verificar se jornada existe
    const existing = await prisma.journey.findUnique({ where: { id: journeyId } });
    if (!existing) {
      throw new Error('Jornada não encontrada');
    }

    // Transação: apagar nós/edges antigos e recriar tudo
    const result = await prisma.$transaction(async (tx) => {
      // Deletar edges primeiro (dependem dos nodes)
      await tx.journeyEdge.deleteMany({
        where: { journeyId },
      });

      // Deletar nodes
      await tx.journeyNode.deleteMany({
        where: { journeyId },
      });

      // Criar nodes
      const createdNodes = await Promise.all(
        graph.nodes.map((node) => {
          // Garantir que config seja um objeto válido
          let nodeConfig = node.config || {};
          if (typeof nodeConfig === 'string') {
            try {
              nodeConfig = JSON.parse(nodeConfig);
            } catch (e) {
              console.warn(`[JourneyService] Erro ao parsear config do nó ${node.id}:`, e);
              nodeConfig = {};
            }
          }
          
          // Log para debug
          if (node.type === 'ACTION') {
            console.log(`[JourneyService] Salvando nó ${node.id} (${node.type}):`, {
              label: node.label,
              config: nodeConfig,
              configType: typeof nodeConfig,
              hasMessage: !!(nodeConfig as any)?.message,
              message: (nodeConfig as any)?.message,
              channelId: (nodeConfig as any)?.channelId,
              configString: JSON.stringify(nodeConfig, null, 2),
            });
          }
          
          return tx.journeyNode.create({
            data: {
              journeyId,
              type: node.type,
              label: node.label,
              config: nodeConfig,
              positionX: node.positionX,
              positionY: node.positionY,
            },
          });
        }),
      );

      // Mapear ids temporários -> ids reais
      const nodeIdMap = new Map<string, string>();
      graph.nodes.forEach((node, index) => {
        if (node.id) {
          nodeIdMap.set(node.id, createdNodes[index].id);
        }
      });

      const resolveNodeId = (id: string) => nodeIdMap.get(id) || id;

      // Criar edges
      await Promise.all(
        graph.edges.map((edge) =>
          tx.journeyEdge.create({
            data: {
              journeyId,
              sourceNodeId: resolveNodeId(edge.sourceNodeId),
              targetNodeId: resolveNodeId(edge.targetNodeId),
              label: edge.label || null,
              condition: edge.condition ?? {},
            },
          }),
        ),
      );

      return tx.journey.findUnique({
        where: { id: journeyId },
        include: {
          nodes: true,
          edges: true,
        },
      });
    });

    return result;
  }
}


