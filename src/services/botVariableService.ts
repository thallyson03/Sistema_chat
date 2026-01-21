import prisma from '../config/database';

export interface CreateBotVariableData {
  botId: string;
  name: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON';
  defaultValue?: string;
  isGlobal?: boolean;
  description?: string;
}

export interface UpdateBotVariableData {
  name?: string;
  type?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON';
  defaultValue?: string;
  isGlobal?: boolean;
  description?: string;
}

export class BotVariableService {
  /**
   * Cria uma nova variável
   */
  async createVariable(data: CreateBotVariableData) {
    // Verificar se já existe variável com mesmo nome para o bot
    const existing = await prisma.botVariable.findUnique({
      where: {
        botId_name: {
          botId: data.botId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new Error(`Variável "${data.name}" já existe para este bot`);
    }

    return await prisma.botVariable.create({
      data: {
        botId: data.botId,
        name: data.name,
        type: data.type,
        defaultValue: data.defaultValue || null,
        isGlobal: data.isGlobal || false,
        description: data.description || null,
      },
    });
  }

  /**
   * Lista todas as variáveis de um bot
   */
  async listVariables(botId: string) {
    return await prisma.botVariable.findMany({
      where: { botId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Busca uma variável por ID
   */
  async getVariableById(id: string) {
    return await prisma.botVariable.findUnique({
      where: { id },
    });
  }

  /**
   * Atualiza uma variável
   */
  async updateVariable(id: string, data: UpdateBotVariableData) {
    const variable = await prisma.botVariable.findUnique({
      where: { id },
    });

    if (!variable) {
      throw new Error('Variável não encontrada');
    }

    // Se mudou o nome, verificar se não conflita com outra variável
    if (data.name && data.name !== variable.name) {
      const existing = await prisma.botVariable.findUnique({
        where: {
          botId_name: {
            botId: variable.botId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new Error(`Variável "${data.name}" já existe para este bot`);
      }
    }

    return await prisma.botVariable.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.defaultValue !== undefined && { defaultValue: data.defaultValue }),
        ...(data.isGlobal !== undefined && { isGlobal: data.isGlobal }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  /**
   * Deleta uma variável
   */
  async deleteVariable(id: string) {
    const variable = await prisma.botVariable.findUnique({
      where: { id },
    });

    if (!variable) {
      throw new Error('Variável não encontrada');
    }

    return await prisma.botVariable.delete({
      where: { id },
    });
  }

  /**
   * Obtém o valor de uma variável do contexto da sessão
   */
  getVariableValue(variableName: string, context: Record<string, any>, botId: string): any {
    // Primeiro verificar no contexto da sessão
    if (context[variableName] !== undefined) {
      return context[variableName];
    }

    // Se não encontrou, buscar valor padrão da variável global
    // (Isso será feito de forma assíncrona quando necessário)
    return undefined;
  }

  /**
   * Define o valor de uma variável no contexto
   */
  setVariableValue(context: Record<string, any>, variableName: string, value: any): Record<string, any> {
    return {
      ...context,
      [variableName]: value,
    };
  }
}



