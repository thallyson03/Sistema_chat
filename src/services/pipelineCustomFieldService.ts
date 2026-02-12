import prisma from '../config/database';

export interface CreateCustomFieldData {
  pipelineId: string;
  name: string;
  type?: string; // TEXT, NUMBER, DATE, EMAIL, PHONE, SELECT
  required?: boolean;
  options?: string[]; // Para tipo SELECT
  order?: number;
}

export interface UpdateCustomFieldData {
  name?: string;
  type?: string;
  required?: boolean;
  options?: string[];
  order?: number;
  isActive?: boolean;
}

export class PipelineCustomFieldService {
  async createCustomField(data: CreateCustomFieldData) {
    // Buscar última ordem
    const lastField = await prisma.pipelineCustomField.findFirst({
      where: { pipelineId: data.pipelineId },
      orderBy: { order: 'desc' },
    });

    const field = await prisma.pipelineCustomField.create({
      data: {
        pipelineId: data.pipelineId,
        name: data.name,
        type: data.type || 'TEXT',
        required: data.required || false,
        options: data.options || [],
        order: data.order !== undefined ? data.order : (lastField ? lastField.order + 1 : 0),
      },
    });

    return field;
  }

  async getCustomFields(pipelineId: string) {
    const fields = await prisma.pipelineCustomField.findMany({
      where: {
        pipelineId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    return fields;
  }

  async updateCustomField(id: string, data: UpdateCustomFieldData) {
    const field = await prisma.pipelineCustomField.update({
      where: { id },
      data,
    });

    return field;
  }

  async deleteCustomField(id: string) {
    await prisma.pipelineCustomField.delete({
      where: { id },
    });
  }

  async reorderCustomFields(pipelineId: string, fieldOrders: Array<{ id: string; order: number }>) {
    const updates = fieldOrders.map(({ id, order }) =>
      prisma.pipelineCustomField.update({
        where: { id },
        data: { order },
      })
    );

    await Promise.all(updates);

    return await prisma.pipelineCustomField.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' },
    });
  }
}



