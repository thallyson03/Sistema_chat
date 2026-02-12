import prisma from '../config/database';

export interface CreatePipelineData {
  name: string;
  description?: string;
  color?: string;
  stages?: Array<{
    name: string;
    description?: string;
    color?: string;
    order: number;
    probability: number;
  }>;
}

export interface UpdatePipelineData {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export interface CreateStageData {
  name: string;
  description?: string;
  color?: string;
  order: number;
  probability: number;
}

export interface UpdateStageData {
  name?: string;
  description?: string;
  color?: string;
  order?: number;
  probability?: number;
  isActive?: boolean;
}

export class PipelineService {
  // ============================================
  // PIPELINES
  // ============================================

  async createPipeline(data: CreatePipelineData) {
    const { stages, ...pipelineData } = data;

    const pipeline = await prisma.pipeline.create({
      data: {
        ...pipelineData,
        color: data.color || '#3B82F6',
        stages: stages
          ? {
              create: stages.map((stage, index) => ({
                name: stage.name,
                description: stage.description,
                color: stage.color || '#6B7280',
                order: stage.order !== undefined ? stage.order : index,
                probability: stage.probability || 0,
              })),
            }
          : undefined,
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return pipeline;
  }

  async getPipelines(includeInactive: boolean = false) {
    const pipelines = await prisma.pipeline.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        stages: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            deals: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pipelines;
  }

  async getPipelineById(id: string) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              include: {
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
            },
          },
        },
        _count: {
          select: {
            deals: true,
          },
        },
      },
    });

    return pipeline;
  }

  async updatePipeline(id: string, data: UpdatePipelineData) {
    const pipeline = await prisma.pipeline.update({
      where: { id },
      data,
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return pipeline;
  }

  async deletePipeline(id: string) {
    // Verificar se há deals no pipeline
    const dealsCount = await prisma.deal.count({
      where: { pipelineId: id },
    });

    if (dealsCount > 0) {
      throw new Error(
        `Não é possível deletar o pipeline. Existem ${dealsCount} negócios associados.`
      );
    }

    await prisma.pipeline.delete({
      where: { id },
    });
  }

  // ============================================
  // STAGES
  // ============================================

  async createStage(pipelineId: string, data: CreateStageData) {
    const stage = await prisma.pipelineStage.create({
      data: {
        pipelineId,
        name: data.name,
        description: data.description,
        color: data.color || '#6B7280',
        order: data.order,
        probability: data.probability || 0,
      },
    });

    return stage;
  }

  async updateStage(id: string, data: UpdateStageData) {
    const stage = await prisma.pipelineStage.update({
      where: { id },
      data,
    });

    return stage;
  }

  async deleteStage(id: string) {
    // Verificar se há deals no stage
    const dealsCount = await prisma.deal.count({
      where: { stageId: id },
    });

    if (dealsCount > 0) {
      throw new Error(
        `Não é possível deletar a etapa. Existem ${dealsCount} negócios nesta etapa.`
      );
    }

    await prisma.pipelineStage.delete({
      where: { id },
    });
  }

  async reorderStages(pipelineId: string, stageOrders: Array<{ id: string; order: number }>) {
    // Atualizar ordem de múltiplas stages
    const updates = stageOrders.map(({ id, order }) =>
      prisma.pipelineStage.update({
        where: { id },
        data: { order },
      })
    );

    await Promise.all(updates);

    // Retornar stages atualizadas
    return await prisma.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' },
    });
  }
}

