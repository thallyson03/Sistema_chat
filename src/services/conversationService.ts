import prisma from '../config/database';
import { ConversationStatus, Priority } from '@prisma/client';

export interface ConversationFilters {
  channelId?: string;
  assignedToId?: string;
  status?: string;
  search?: string;
  contactId?: string;
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

    if (filters.channelId) {
      where.channelId = filters.channelId;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    if (filters.status) {
      where.status = filters.status as ConversationStatus;
    }

    if (filters.search) {
      where.OR = [
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
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
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
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
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
      conversations: conversations.map((conv) => ({
        ...conv,
        lastMessage: conv.messages[0]?.content || '',
        lastCustomerMessageAt: conv.lastCustomerMessageAt?.toISOString() || null,
        lastAgentMessageAt: conv.lastAgentMessageAt?.toISOString() || null,
      })),
      total,
    };
  }

  async getConversationById(id: string) {
    return await prisma.conversation.findUnique({
      where: { id },
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

    return await prisma.conversation.update({
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

    return await prisma.conversation.update({
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
