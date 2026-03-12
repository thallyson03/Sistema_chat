import prisma from '../config/database';
import { ConversationStatus, Priority } from '@prisma/client';
import { ConversationDistributionService } from './conversationDistributionService';

export interface ConversationFilters {
  channelId?: string;
  assignedToId?: string;
  status?: string;
  search?: string;
  contactId?: string;
  inBot?: boolean;
}

export class ConversationService {
  async createConversation(data: { channelId: string; contactId: string; assignedToId?: string }) {
    // Verificar se já existe conversa para este contato neste canal
    const existing = await prisma.conversation.findFirst({
      where: {
        channelId: data.channelId,
        contactId: data.contactId,
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = await prisma.conversation.create({
      data: {
        channelId: data.channelId,
        contactId: data.contactId,
        assignedToId: data.assignedToId,
        status: ConversationStatus.OPEN,
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profilePicture: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return conversation;
  }

  async getConversations(filters: ConversationFilters, limit: number, offset: number) {
    const where: any = {};
    const andConditions: any[] = [];

    if (filters.channelId) {
      andConditions.push({ channelId: filters.channelId });
    }

    if (filters.assignedToId) {
      andConditions.push({ assignedToId: filters.assignedToId });
    }

    if (filters.contactId) {
      andConditions.push({ contactId: filters.contactId });
    }

    if (filters.status) {
      andConditions.push({ status: filters.status as ConversationStatus });
    }

    // Conversas que estão em automação (bot interno ou integrações n8n ativas sem humano)
    if (filters.inBot === true) {
      andConditions.push({
        OR: [
          // Sessão de bot ativa para esta conversa
          {
            botSession: {
              is: {
                isActive: true,
              },
            },
          },
          // Ou canal com webhook ativo E conversa ainda não atribuída a humano
          {
            AND: [
              { assignedToId: null },
              {
                channel: {
                  is: {
                    webhooks: {
                      some: {
                        isActive: true,
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      });
    }

    if (filters.search) {
      andConditions.push({
        OR: [
          {
            contact: {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          },
          {
            contact: {
              phone: {
                contains: filters.search,
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          channel: {
            include: {
              webhooks: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
            },
          },
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          botSession: {
            select: {
              isActive: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              content: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations: conversations.map((conv) => {
        const hasActiveBotSession = !!(conv as any).botSession?.isActive;
        const hasActiveWebhook =
          !!(conv as any).channel?.webhooks?.some((w: any) => w.isActive);
        const inBot = hasActiveBotSession || (hasActiveWebhook && !conv.assignedToId);

        return {
          ...conv,
          lastMessage: conv.messages[0]?.content || '',
          lastCustomerMessageAt: conv.lastCustomerMessageAt?.toISOString() || null,
          lastAgentMessageAt: conv.lastAgentMessageAt?.toISOString() || null,
          inBot,
        };
      }),
      total,
    };
  }

  async getConversationById(id: string) {
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: {
        channel: {
          include: {
            webhooks: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        },
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        botSession: {
          select: {
            isActive: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!conv) return null;

    const hasActiveBotSession = !!(conv as any).botSession?.isActive;
    const hasActiveWebhook =
      !!(conv as any).channel?.webhooks?.some((w: any) => w.isActive);
    const inBot = hasActiveBotSession || (hasActiveWebhook && !conv.assignedToId);

    return {
      ...conv,
      lastCustomerMessageAt: conv.lastCustomerMessageAt?.toISOString() || null,
      lastAgentMessageAt: conv.lastAgentMessageAt?.toISOString() || null,
      inBot,
    } as any;
  }

  async updateConversation(
    id: string,
    data: { assignedToId?: string; status?: string; priority?: string },
    validateSector: boolean = true
  ) {
    // Se está transferindo para outro usuário, validar setor
    if (data.assignedToId !== undefined && data.assignedToId && validateSector) {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
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

      // Se o canal tem setor, verificar se o usuário pode atender esse setor
      if (conversation.channel?.sectorId) {
        const userSector = await prisma.userSector.findFirst({
          where: {
            userId: data.assignedToId,
            sectorId: conversation.channel.sectorId,
          },
        });

        if (!userSector) {
          throw new Error(
            `Usuário não está autorizado a atender o setor "${conversation.channel.sector?.name || 'sem setor'}". O canal pertence ao setor "${conversation.channel.sector?.name}" e o usuário não possui permissão para atendê-lo.`
          );
        }
      }
    }

    const updateData: any = {};

    if (data.assignedToId !== undefined) {
      updateData.assignedToId = data.assignedToId || null;
    }

    if (data.status) {
      updateData.status = data.status as ConversationStatus;
    }

    if (data.priority) {
      updateData.priority = data.priority as Priority;
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        channel: true,
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Se a conversa foi atribuída a um usuário, desativar qualquer sessão de bot ativa
    if (data.assignedToId) {
      await prisma.botSession.updateMany({
        where: {
          conversationId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          handoffToUserId: data.assignedToId,
          handoffAt: new Date(),
        },
      });
    }

    return updated;
  }

  async deleteConversation(id: string) {
    // Deletar mensagens primeiro para evitar problemas de chave estrangeira
    await prisma.message.deleteMany({
      where: { conversationId: id },
    });

    // Deletar sessões de bot vinculadas
    await prisma.botSession.deleteMany({
      where: { conversationId: id },
    });

    // Deletar tickets vinculados
    await prisma.ticket.deleteMany({
      where: { conversationId: id },
    });

    // Finalmente, deletar a conversa
    await prisma.conversation.delete({
      where: { id },
    });
  }

  /**
   * Transfere a conversa para um setor (fila), opcionalmente redistribuindo
   * para um atendente elegível desse setor.
   */
  async transferToSector(
    id: string,
    sectorId: string,
    options: { autoAssign?: boolean } = {},
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        channel: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    if (!conversation.channelId || !conversation.channel) {
      throw new Error('Conversa não possui canal associado');
    }

    // Limpar atendente atual (volta para a fila)
    let updated = await prisma.conversation.update({
      where: { id },
      data: {
        assignedToId: null,
      },
      include: {
        channel: true,
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Se autoAssign, redistribuir imediatamente para um usuário do setor informado
    if (options.autoAssign) {
      const distributionService = new ConversationDistributionService();
      const newUserId = await distributionService.distributeConversation(id, {
        channelId: conversation.channelId,
        sectorId,
      });

      if (newUserId) {
        updated = await prisma.conversation.update({
          where: { id },
          data: {
            assignedToId: newUserId,
          },
          include: {
            channel: true,
            contact: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      }
    }

    return updated;
  }

  async assignConversation(id: string, userId: string, validateSector: boolean = true) {
    // Se validateSector, verificar se o usuário pode atender o setor do canal
    if (validateSector) {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
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

      // Se o canal tem setor, verificar se o usuário pode atender esse setor
      if (conversation.channel?.sectorId) {
        const userSector = await prisma.userSector.findFirst({
          where: {
            userId,
            sectorId: conversation.channel.sectorId,
          },
        });

        if (!userSector) {
          throw new Error(
            `Usuário não está autorizado a atender o setor "${conversation.channel.sector?.name || 'sem setor'}". O canal pertence ao setor "${conversation.channel.sector?.name}" e o usuário não possui permissão para atendê-lo.`
          );
        }
      }
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        assignedToId: userId,
      },
      include: {
        channel: true,
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Desativar qualquer sessão de bot ativa ao atribuir para humano
    await prisma.botSession.updateMany({
      where: {
        conversationId: id,
        isActive: true,
      },
      data: {
        isActive: false,
        handoffToUserId: userId,
        handoffAt: new Date(),
      },
    });

    return updated;
  }

  async getUnreadCount(userId?: string) {
    if (!userId) {
      return 0;
    }

    return await prisma.conversation.count({
      where: {
        OR: [
          { assignedToId: userId, unreadCount: { gt: 0 } },
          { assignedToId: null, unreadCount: { gt: 0 } },
        ],
      },
    });
  }

  async getStats() {
    const [total, open, waiting, closed] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({
        where: { status: ConversationStatus.OPEN },
      }),
      prisma.conversation.count({
        where: { status: ConversationStatus.WAITING },
      }),
      prisma.conversation.count({
        where: { status: ConversationStatus.CLOSED },
      }),
    ]);

    return {
      total,
      open,
      waiting,
      closed,
    };
  }
}
