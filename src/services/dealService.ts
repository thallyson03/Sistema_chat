import prisma from '../config/database';
import { DealStatus } from '@prisma/client';

export interface CreateDealData {
  pipelineId: string;
  stageId: string;
  contactId: string;
  conversationId?: string;
  assignedToId?: string;
  name: string; // Nome do lead/negócio
  value?: number; // Valor opcional
  currency?: string;
  customFields?: Record<string, any>; // Campos personalizados
  probability?: number;
  expectedCloseDate?: Date;
}

export interface UpdateDealData {
  stageId?: string;
  assignedToId?: string;
  name?: string;
  value?: number;
  currency?: string;
  customFields?: Record<string, any>;
  probability?: number;
  expectedCloseDate?: Date;
  status?: DealStatus;
  closedReason?: string;
}

export interface CreateDealActivityData {
  dealId: string;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  metadata?: any;
}

export class DealService {
  async createDeal(data: CreateDealData) {
    // Verificar se já existe um deal para esta conversa (se conversationId foi fornecido)
    if (data.conversationId) {
      const existingDeal = await prisma.deal.findUnique({
        where: { conversationId: data.conversationId },
      });

      if (existingDeal) {
        throw new Error(
          `Já existe um negócio para esta conversa. Deal ID: ${existingDeal.id}`
        );
      }
    }

    // Buscar stage para obter probabilidade padrão se não fornecida
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: data.stageId },
    });

    const deal = await prisma.deal.create({
      data: {
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        contactId: data.contactId,
        conversationId: data.conversationId,
        assignedToId: data.assignedToId,
        name: data.name,
        value: data.value,
        currency: data.currency || 'BRL',
        customFields: data.customFields || {},
        probability: data.probability !== undefined ? data.probability : (stage?.probability || 0),
        expectedCloseDate: data.expectedCloseDate,
      },
      include: {
        pipeline: true,
        stage: true,
        contact: {
          include: {
            channel: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Criar atividade de criação
    await prisma.dealActivity.create({
      data: {
        dealId: deal.id,
        userId: data.assignedToId,
        type: 'STAGE_CHANGE',
        title: 'Negócio criado',
        description: `Negócio criado na etapa "${stage?.name || 'N/A'}"`,
      },
    });

    return deal;
  }

  async getDeals(filters: {
    pipelineId?: string;
    stageId?: string;
    contactId?: string;
    assignedToId?: string;
    status?: DealStatus;
    search?: string;
  }) {
    const where: any = {};

    if (filters.pipelineId) {
      where.pipelineId = filters.pipelineId;
    }

    if (filters.stageId) {
      where.stageId = filters.stageId;
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { contact: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            order: true,
          },
        },
        contact: {
          include: {
            channel: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            activities: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return deals;
  }

  async getDealById(id: string) {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        pipeline: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
            },
          },
        },
        stage: true,
        contact: {
          include: {
            channel: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return deal;
  }

  async updateDeal(id: string, data: UpdateDealData) {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
      },
    });

    if (!deal) {
      throw new Error('Negócio não encontrado');
    }

    // Verificar se mudou de stage
    const stageChanged = data.stageId && data.stageId !== deal.stageId;
    const oldStage = deal.stage;

    // Atualizar deal
    const updatedDeal = await prisma.deal.update({
      where: { id },
      data: {
        ...data,
        // Se mudou status para WON ou LOST, definir closedAt
        closedAt:
          data.status === 'WON' || data.status === 'LOST'
            ? new Date()
            : data.status === 'OPEN'
            ? null
            : undefined,
      },
      include: {
        pipeline: true,
        stage: true,
        contact: {
          include: {
            channel: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Criar atividade se mudou de stage
    if (stageChanged && oldStage) {
      const newStage = await prisma.pipelineStage.findUnique({
        where: { id: data.stageId! },
      });

      await prisma.dealActivity.create({
        data: {
          dealId: id,
          type: 'STAGE_CHANGE',
          title: 'Mudança de etapa',
          description: `De "${oldStage.name}" para "${newStage?.name || 'N/A'}"`,
        },
      });
    }

    // Criar atividade se mudou status
    if (data.status && data.status !== deal.status) {
      await prisma.dealActivity.create({
        data: {
          dealId: id,
          type: 'STAGE_CHANGE',
          title: `Status alterado para ${data.status}`,
          description: data.closedReason || undefined,
        },
      });
    }

    return updatedDeal;
  }

  async moveDealToStage(dealId: string, newStageId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        stage: true,
      },
    });

    if (!deal) {
      throw new Error('Negócio não encontrado');
    }

    const newStage = await prisma.pipelineStage.findUnique({
      where: { id: newStageId },
    });

    if (!newStage) {
      throw new Error('Etapa não encontrada');
    }

    // Verificar se a nova stage pertence ao mesmo pipeline
    if (newStage.pipelineId !== deal.pipelineId) {
      throw new Error('A nova etapa deve pertencer ao mesmo pipeline');
    }

    // Atualizar deal
    const updatedDeal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId: newStageId,
        probability: newStage.probability,
      },
      include: {
        pipeline: true,
        stage: true,
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

    // Criar atividade
    await prisma.dealActivity.create({
      data: {
        dealId: dealId,
        type: 'STAGE_CHANGE',
        title: 'Mudança de etapa',
        description: `De "${deal.stage.name}" para "${newStage.name}"`,
      },
    });

    return updatedDeal;
  }

  async deleteDeal(id: string) {
    await prisma.deal.delete({
      where: { id },
    });
  }

  // ============================================
  // ACTIVITIES
  // ============================================

  async createActivity(data: CreateDealActivityData) {
    const activity = await prisma.dealActivity.create({
      data: {
        dealId: data.dealId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
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
    });

    return activity;
  }

  async getDealActivities(dealId: string) {
    const activities = await prisma.dealActivity.findMany({
      where: { dealId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities;
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getPipelineStats(pipelineId: string) {
    const deals = await prisma.deal.findMany({
      where: { pipelineId },
      select: {
        status: true,
        value: true,
        stageId: true,
        stage: {
          select: {
            name: true,
            probability: true,
          },
        },
      },
    });

    const totalDeals = deals.length;
    const wonDeals = deals.filter((d) => d.status === 'WON').length;
    const lostDeals = deals.filter((d) => d.status === 'LOST').length;
    const openDeals = deals.filter((d) => d.status === 'OPEN').length;

    const totalValue = deals
      .filter((d) => d.status === 'WON')
      .reduce((sum, d) => sum + Number(d.value || 0), 0);

    const expectedValue = deals
      .filter((d) => d.status === 'OPEN')
      .reduce((sum, d) => sum + Number(d.value || 0) * (d.stage?.probability || 0) / 100, 0);

    // Estatísticas por stage
    const stageStats = deals.reduce((acc, deal) => {
      const stageName = deal.stage?.name || 'Sem etapa';
      if (!acc[stageName]) {
        acc[stageName] = {
          name: stageName,
          count: 0,
          value: 0,
        };
      }
      acc[stageName].count++;
      acc[stageName].value += Number(deal.value || 0);
      return acc;
    }, {} as Record<string, { name: string; count: number; value: number }>);

    return {
      totalDeals,
      wonDeals,
      lostDeals,
      openDeals,
      totalValue,
      expectedValue,
      conversionRate: totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0,
      stageStats: Object.values(stageStats),
    };
  }
}

