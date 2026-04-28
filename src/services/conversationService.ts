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

interface ConversationViewer {
  id: string;
  role: string;
}

export class ConversationService {
  private async buildVisibilityWhere(viewer?: ConversationViewer) {
    // Chamadas internas do serviço (sem viewer) não devem ser bloqueadas.
    if (!viewer) {
      return {};
    }

    // Com viewer informado, id é obrigatório.
    if (!viewer.id) {
      return { id: '__no_access__' };
    }

    // ADMIN mantém visão global.
    if (viewer.role === 'ADMIN') {
      return {};
    }

    const userSectors = await prisma.userSector.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const sectorIds = userSectors.map((s) => s.sectorId);
    if (sectorIds.length === 0) {
      return { id: '__no_access__' };
    }

    // "Setor primário e agregados":
    // - setor atual da conversa (conversation.sectorId), quando definido
    // - ou setor principal/secundário do canal quando conversation.sectorId for nulo
    return {
      OR: [
        { sectorId: { in: sectorIds } },
        {
          AND: [
            { sectorId: null },
            {
              channel: {
                is: {
                  sectorId: { in: sectorIds },
                },
              },
            },
          ],
        },
        {
          AND: [
            { sectorId: null },
            {
              channel: {
                is: {
                  secondarySectors: {
                    some: {
                      sectorId: { in: sectorIds },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

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

  async getConversations(
    filters: ConversationFilters,
    limit: number,
    offset: number,
    viewer?: ConversationViewer,
  ) {
    const where: any = {};
    const andConditions: any[] = [];
    const visibilityWhere = await this.buildVisibilityWhere(viewer);
    andConditions.push(visibilityWhere);

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

    // Regra de negócio: conversa só aparece na lista principal
    // quando houver mensagem "real" (não apenas notificação interna).
    andConditions.push({
      messages: {
        some: {
          OR: [
            { userId: { not: null } }, // mensagem de agente
            { metadata: { path: ['fromBot'], not: true } }, // cliente/entrada normal
            { metadata: { path: ['internalOnly'], not: true } }, // bot externo / não-interno
          ],
        },
      },
    });

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          channel: {
            include: {
              sector: true,
              secondarySectors: {
                include: {
                  sector: true,
                },
              },
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

  async getConversationById(id: string, viewer?: ConversationViewer) {
    const visibilityWhere = await this.buildVisibilityWhere(viewer);
    const conv = await prisma.conversation.findFirst({
      where: {
        id,
        ...visibilityWhere,
      },
      include: {
        channel: {
          include: {
            sector: true,
            secondarySectors: {
              include: {
                sector: true,
              },
            },
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

  async canViewerAccessConversation(conversationId: string, viewer?: ConversationViewer) {
    const visibilityWhere = await this.buildVisibilityWhere(viewer);
    const total = await prisma.conversation.count({
      where: {
        AND: [{ id: conversationId }, visibilityWhere],
      },
    });
    return total > 0;
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

    // Deletar tags vinculadas à conversa (FK ConversationTag -> Conversation é RESTRICT)
    await prisma.conversationTag.deleteMany({
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
   * Transfere a conversa para um setor (fila), opcionalmente para um usuário
   * específico desse setor, ou redistribuindo (autoAssign).
   */
  async transferToSector(
    id: string,
    sectorId: string,
    options: { autoAssign?: boolean; userId?: string } = {},
  ) {
    const { autoAssign, userId } = options;

    if (userId && autoAssign) {
      throw new Error('Não é possível usar userId e autoAssign ao mesmo tempo.');
    }

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

    if (userId) {
      const userSector = await prisma.userSector.findFirst({
        where: { userId, sectorId },
        include: {
          user: { select: { id: true, isActive: true, name: true } },
        },
      });

      if (!userSector) {
        throw new Error('O usuário selecionado não pertence ao setor escolhido.');
      }

      if (!userSector.user.isActive) {
        throw new Error('Não é possível transferir para um usuário inativo.');
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          sectorId,
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

      await prisma.botSession.updateMany({
        where: { conversationId: id, isActive: true },
        data: {
          isActive: false,
          handoffToUserId: userId,
          handoffAt: new Date(),
        },
      });

      return updated;
    }

    // Limpar atendente atual (volta para a fila do setor)
    let updated = await prisma.conversation.update({
      where: { id },
      data: {
        assignedToId: null,
        sectorId,
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
    if (autoAssign) {
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

        // Se foi atribuído para um humano, desligar o bot para esta conversa
        await prisma.botSession.updateMany({
          where: { conversationId: id, isActive: true },
          data: { isActive: false },
        });
      }
    }

    // Se a conversa ficou sem humano atribuído, garantir que o bot do setor correto esteja ativo.
    if (!updated.assignedToId) {
      await this.activateBotForConversation(id);
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
      const targetSectorId = conversation.sectorId || conversation.channel?.sectorId;
      if (targetSectorId) {
        const userSector = await prisma.userSector.findFirst({
          where: {
            userId,
            sectorId: targetSectorId,
          },
        });

        if (!userSector) {
          throw new Error(
            `Usuário não está autorizado a atender o setor "${targetSectorId}". O usuário não possui permissão para atendê-lo.`
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

  async activateBotForConversation(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        channel: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    if (!conversation.channelId) {
      throw new Error('Conversa não possui canal associado');
    }

    const primarySectorId = conversation.channel?.sectorId || null;
    const currentSectorId = conversation.sectorId || primarySectorId;

    // Regra: se existe contexto de setor (currentSectorId não nulo),
    // NÃO fazemos fallback para bot de canal.
    // Se não houver bot ativo no setor, o bot NÃO existe (comportamento normal).
    if (currentSectorId) {
      const botForSector = await prisma.bot.findFirst({
        where: {
          channelId: conversation.channelId,
          isActive: true,
          sectorId: currentSectorId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!botForSector) {
        // Garantir que uma sessão anterior fique desativada.
        await prisma.botSession.updateMany({
          where: { conversationId: id, isActive: true },
          data: { isActive: false },
        });
        return null;
      }

      // Prossegue usando o bot daquele setor.
      // eslint-disable-next-line prefer-destructuring
      // (mantém a variável bot como no código original)
      var bot: any = botForSector;
    } else {
      // Sem contexto de setor (legado): usa bot legacy (sectorId = null) se existir.
      const legacyBot = await prisma.bot.findFirst({
        where: {
          channelId: conversation.channelId,
          isActive: true,
          sectorId: null,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!legacyBot) {
        await prisma.botSession.updateMany({
          where: { conversationId: id, isActive: true },
          data: { isActive: false },
        });
        return null;
      }

      var bot: any = legacyBot;
    }

    // Voltar para automação: remove atendente humano.
    await prisma.conversation.update({
      where: { id },
      data: {
        assignedToId: null,
      },
    });

    const existingSession = await prisma.botSession.findUnique({
      where: { conversationId: id },
    });

    if (!existingSession) {
      await prisma.botSession.create({
        data: {
          botId: bot.id,
          conversationId: id,
          isActive: true,
          currentFlowId: null,
          currentStepId: null,
          context: {
            mode: 'outside',
            sectorId: currentSectorId,
          },
          handoffToUserId: null,
          handoffAt: null,
        },
      });
    } else {
      await prisma.botSession.update({
        where: { id: existingSession.id },
        data: {
          botId: bot.id,
          isActive: true,
          currentFlowId: null,
          currentStepId: null,
          handoffToUserId: null,
          handoffAt: null,
          context: {
            ...(existingSession.context as any || {}),
            mode: 'outside',
            sectorId: currentSectorId,
          },
        },
      });
    }

    const updatedConversation = await this.getConversationById(id);
    if (!updatedConversation) {
      throw new Error('Conversa não encontrada após ativar bot');
    }

    return updatedConversation;
  }

  async getUnreadCount(userId?: string, viewer?: ConversationViewer) {
    if (!userId || !viewer) {
      return 0;
    }
    const visibilityWhere = await this.buildVisibilityWhere(viewer);

    return await prisma.conversation.count({
      where: {
        AND: [
          visibilityWhere,
          {
            OR: [
              { assignedToId: userId, unreadCount: { gt: 0 } },
              { assignedToId: null, unreadCount: { gt: 0 } },
            ],
          },
        ],
      },
    });
  }

  async getStats(viewer?: ConversationViewer) {
    const visibilityWhere = await this.buildVisibilityWhere(viewer);
    const ownershipWhere =
      viewer && viewer.role !== 'ADMIN'
        ? viewer.id
          ? { assignedToId: viewer.id }
          : { id: '__no_access__' }
        : {};
    const [total, open, waiting, closed] = await Promise.all([
      prisma.conversation.count({
        where: {
          AND: [visibilityWhere, ownershipWhere],
        },
      }),
      prisma.conversation.count({
        where: {
          AND: [visibilityWhere, ownershipWhere, { status: ConversationStatus.OPEN }],
        },
      }),
      prisma.conversation.count({
        where: {
          AND: [visibilityWhere, ownershipWhere, { status: ConversationStatus.WAITING }],
        },
      }),
      prisma.conversation.count({
        where: {
          AND: [visibilityWhere, ownershipWhere, { status: ConversationStatus.CLOSED }],
        },
      }),
    ]);

    return {
      total,
      open,
      waiting,
      closed,
    };
  }

  /**
   * Métricas de conversas para o dashboard (inclui bot e fila), com filtros opcionais.
   * `days`: apenas conversas criadas nos últimos N dias (omitir ou 0 = todo o período).
   */
  async getDashboardConversationMetrics(
    viewer?: ConversationViewer,
    filters?: { channelId?: string; sectorId?: string; days?: number },
  ) {
    const visibilityWhere = await this.buildVisibilityWhere(viewer);
    const ownershipWhere =
      viewer && viewer.role !== 'ADMIN'
        ? viewer.id
          ? { assignedToId: viewer.id }
          : { id: '__no_access__' }
        : {};

    const days = filters?.days;
    const hasDays = typeof days === 'number' && Number.isFinite(days) && days > 0;
    const createdGte = hasDays
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - Math.floor(days as number));
          d.setHours(0, 0, 0, 0);
          return d;
        })()
      : null;

    const baseAnd: object[] = [
      visibilityWhere,
      ownershipWhere,
      ...(filters?.channelId ? [{ channelId: filters.channelId }] : []),
      ...(filters?.sectorId ? [{ sectorId: filters.sectorId }] : []),
      ...(createdGte ? [{ createdAt: { gte: createdGte } }] : []),
    ];

    const baseWhere = { AND: baseAnd };

    const [
      total,
      open,
      waiting,
      closed,
      inBot,
      finishedByBot,
    ] = await Promise.all([
      prisma.conversation.count({ where: baseWhere }),
      prisma.conversation.count({
        where: { AND: [...baseAnd, { status: ConversationStatus.OPEN }] },
      }),
      prisma.conversation.count({
        where: { AND: [...baseAnd, { status: ConversationStatus.WAITING }] },
      }),
      prisma.conversation.count({
        where: { AND: [...baseAnd, { status: ConversationStatus.CLOSED }] },
      }),
      prisma.conversation.count({
        where: {
          AND: [
            ...baseAnd,
            {
              botSession: {
                is: {
                  isActive: true,
                  handoffToUserId: null,
                },
              },
            },
          ],
        },
      }),
      prisma.conversation.count({
        where: {
          AND: [
            ...baseAnd,
            { status: ConversationStatus.CLOSED },
            {
              botSession: {
                is: {
                  handoffToUserId: null,
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      total,
      open,
      waiting,
      closed,
      inBot,
      finishedByBot,
      filters: {
        channelId: filters?.channelId ?? null,
        sectorId: filters?.sectorId ?? null,
        days: hasDays ? Math.floor(days as number) : null,
      },
    };
  }
}
