import prisma from '../config/database';
import { ConversationStatus } from '@prisma/client';

export interface DistributionCriteria {
  channelId: string;
  sectorId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class ConversationDistributionService {
  /**
   * Distribui uma conversa para o usuário mais adequado
   * Considera:
   * - Usuários ativos e não em pausa
   * - Permissão no setor do canal
   * - Carga de trabalho (menos conversas = prioridade)
   * - Role do usuário (ADMIN/SUPERVISOR podem ter menos carga)
   */
  async distributeConversation(conversationId: string, criteria?: DistributionCriteria): Promise<string | null> {
    // Buscar a conversa
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        channel: {
          include: {
            sector: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Se a conversa já tem um usuário atribuído, não redistribuir
    if (conversation.assignedToId) {
      return conversation.assignedToId;
    }

    // Buscar canal se não fornecido
    const channelId = criteria?.channelId || conversation.channelId;
    
    if (!channelId) {
      throw new Error('Canal não encontrado para distribuição da conversa');
    }
    
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        sector: true,
      },
    });

    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    const sectorId = criteria?.sectorId !== undefined ? criteria.sectorId : channel.sectorId;

    // Buscar usuários disponíveis
    const availableUsers = await this.getAvailableUsers(sectorId);

    if (availableUsers.length === 0) {
      console.log('[ConversationDistribution] Nenhum usuário disponível para distribuição');
      return null;
    }

    // Calcular carga de trabalho de cada usuário
    const usersWithWorkload = await Promise.all(
      availableUsers.map(async (user) => {
        const openConversationsCount = await prisma.conversation.count({
          where: {
            assignedToId: user.id,
            status: {
              in: ['OPEN', 'WAITING'],
            },
          },
        });

        // Peso por role (ADMIN e SUPERVISOR podem ter menos carga)
        const roleWeight = user.role === 'ADMIN' ? 0.5 : user.role === 'SUPERVISOR' ? 0.7 : 1.0;

        return {
          ...user,
          workload: openConversationsCount * roleWeight,
        };
      })
    );

    // Ordenar por carga de trabalho (menor = prioridade)
    usersWithWorkload.sort((a, b) => a.workload - b.workload);

    // Selecionar o usuário com menor carga
    const selectedUser = usersWithWorkload[0];

    // Atribuir conversa ao usuário selecionado
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId: selectedUser.id,
        status: ConversationStatus.OPEN,
      },
    });

    console.log(`[ConversationDistribution] Conversa ${conversationId} atribuída a ${selectedUser.name} (carga: ${selectedUser.workload.toFixed(1)})`);

    return selectedUser.id;
  }

  /**
   * Busca usuários disponíveis para atender
   * - Ativos
   * - Não em pausa
   * - Online (lastActiveAt nos últimos 5 minutos)
   * - Com permissão no setor (se houver setor no canal)
   */
  async getAvailableUsers(sectorId?: string | null): Promise<any[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const where: any = {
      isActive: true,
      isPaused: false,
      lastActiveAt: {
        gte: fiveMinutesAgo, // Usuário ativo nos últimos 5 minutos
      },
    };

    // Se houver setor, buscar apenas usuários com permissão nesse setor
    if (sectorId) {
      const usersWithSector = await prisma.user.findMany({
        where: {
          ...where,
          sectors: {
            some: {
              sectorId: sectorId,
            },
          },
        },
        include: {
          sectors: {
            include: {
              sector: true,
            },
          },
        },
      });

      return usersWithSector;
    }

    // Se não houver setor, buscar todos os usuários ativos e não em pausa
    const users = await prisma.user.findMany({
      where,
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    return users;
  }

  /**
   * Redistribui todas as conversas não atribuídas
   */
  async redistributeUnassignedConversations(): Promise<number> {
    const unassignedConversations = await prisma.conversation.findMany({
      where: {
        assignedToId: null,
        status: {
          in: ['OPEN', 'WAITING'],
        },
      },
      include: {
        channel: {
          include: {
            sector: true,
          },
        },
      },
    });

    let distributed = 0;

    for (const conversation of unassignedConversations) {
      try {
        if (!conversation.channelId || !conversation.channel) {
          console.warn(`[ConversationDistribution] Conversa ${conversation.id} não possui canal associado, pulando distribuição`);
          continue;
        }

        const userId = await this.distributeConversation(conversation.id, {
          channelId: conversation.channelId,
          sectorId: conversation.channel.sectorId || undefined,
        });

        if (userId) {
          distributed++;
        }
      } catch (error) {
        console.error(`[ConversationDistribution] Erro ao redistribuir conversa ${conversation.id}:`, error);
      }
    }

    console.log(`[ConversationDistribution] ${distributed} conversas redistribuídas`);

    return distributed;
  }

  /**
   * Redistribui conversas de um usuário em pausa
   */
  async redistributePausedUserConversations(userId: string): Promise<number> {
    const userConversations = await prisma.conversation.findMany({
      where: {
        assignedToId: userId,
        status: {
          in: ['OPEN', 'WAITING'],
        },
      },
      include: {
        channel: {
          include: {
            sector: true,
          },
        },
      },
    });

    let redistributed = 0;

    for (const conversation of userConversations) {
      try {
        // Remover atribuição atual
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            assignedToId: null,
          },
        });

        // Redistribuir
        if (!conversation.channelId || !conversation.channel) {
          console.warn(`[ConversationDistribution] Conversa ${conversation.id} não possui canal associado, pulando redistribuição`);
          continue;
        }

        const newUserId = await this.distributeConversation(conversation.id, {
          channelId: conversation.channelId,
          sectorId: conversation.channel.sectorId || undefined,
        });

        if (newUserId && newUserId !== userId) {
          redistributed++;
        }
      } catch (error) {
        console.error(`[ConversationDistribution] Erro ao redistribuir conversa ${conversation.id}:`, error);
      }
    }

    console.log(`[ConversationDistribution] ${redistributed} conversas redistribuídas do usuário ${userId}`);

    return redistributed;
  }
}

