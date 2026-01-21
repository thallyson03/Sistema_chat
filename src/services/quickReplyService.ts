import prisma from '../config/database';
import { MessageType } from '@prisma/client';

export interface CreateQuickReplyData {
  name: string;
  shortcut?: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  category?: string;
  userId?: string;
  isGlobal?: boolean;
}

export interface UpdateQuickReplyData {
  name?: string;
  shortcut?: string;
  content?: string;
  type?: MessageType;
  mediaUrl?: string;
  category?: string;
  isGlobal?: boolean;
}

export class QuickReplyService {
  async create(data: CreateQuickReplyData) {
    // Verificar se já existe um shortcut igual para o mesmo usuário
    if (data.shortcut) {
      const existing = await prisma.quickReply.findFirst({
        where: {
          shortcut: data.shortcut,
          userId: data.userId || null,
        },
      });

      if (existing) {
        throw new Error('Já existe uma resposta rápida com este atalho');
      }
    }

    return await prisma.quickReply.create({
      data: {
        name: data.name,
        shortcut: data.shortcut,
        content: data.content,
        type: data.type || MessageType.TEXT,
        mediaUrl: data.mediaUrl,
        category: data.category,
        userId: data.userId,
        isGlobal: data.isGlobal || false,
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
  }

  async update(id: string, data: UpdateQuickReplyData, userId?: string) {
    // Verificar se o usuário tem permissão para editar
    const quickReply = await prisma.quickReply.findUnique({
      where: { id },
    });

    if (!quickReply) {
      throw new Error('Resposta rápida não encontrada');
    }

    // Se não for global e tiver userId, verificar se é do usuário
    if (!quickReply.isGlobal && quickReply.userId && userId && quickReply.userId !== userId) {
      throw new Error('Você não tem permissão para editar esta resposta rápida');
    }

    // Verificar shortcut duplicado se estiver sendo atualizado
    if (data.shortcut && data.shortcut !== quickReply.shortcut) {
      const existing = await prisma.quickReply.findFirst({
        where: {
          shortcut: data.shortcut,
          userId: quickReply.userId,
          id: { not: id },
        },
      });

      if (existing) {
        throw new Error('Já existe uma resposta rápida com este atalho');
      }
    }

    return await prisma.quickReply.update({
      where: { id },
      data: {
        name: data.name,
        shortcut: data.shortcut,
        content: data.content,
        type: data.type,
        mediaUrl: data.mediaUrl,
        category: data.category,
        isGlobal: data.isGlobal,
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
  }

  async delete(id: string, userId?: string) {
    const quickReply = await prisma.quickReply.findUnique({
      where: { id },
    });

    if (!quickReply) {
      throw new Error('Resposta rápida não encontrada');
    }

    // Se não for global e tiver userId, verificar se é do usuário
    if (!quickReply.isGlobal && quickReply.userId && userId && quickReply.userId !== userId) {
      throw new Error('Você não tem permissão para deletar esta resposta rápida');
    }

    return await prisma.quickReply.delete({
      where: { id },
    });
  }

  async getById(id: string) {
    return await prisma.quickReply.findUnique({
      where: { id },
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
  }

  async list(userId?: string, category?: string) {
    const where: any = {};

    // Se userId fornecido, mostrar globais + pessoais do usuário
    if (userId) {
      where.OR = [
        { isGlobal: true },
        { userId: userId },
      ];
    } else {
      // Se não fornecido, mostrar apenas globais
      where.isGlobal = true;
    }

    if (category) {
      where.category = category;
    }

    return await prisma.quickReply.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getCategories(userId?: string) {
    const where: any = {};

    if (userId) {
      where.OR = [
        { isGlobal: true },
        { userId: userId },
      ];
    } else {
      where.isGlobal = true;
    }

    const quickReplies = await prisma.quickReply.findMany({
      where,
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    return quickReplies
      .map((qr) => qr.category)
      .filter((cat): cat is string => cat !== null);
  }

  /**
   * Substitui variáveis no conteúdo da mensagem
   * Variáveis suportadas: {{nome}}, {{empresa}}, {{telefone}}, {{email}}
   */
  replaceVariables(
    content: string,
    contact?: { name?: string | null; phone?: string | null; email?: string | null },
    conversation?: { channel?: { name?: string } }
  ) {
    let result = content;

    if (contact) {
      result = result.replace(/\{\{nome\}\}/gi, contact.name || 'Cliente');
      result = result.replace(/\{\{telefone\}\}/gi, contact.phone || '');
      result = result.replace(/\{\{email\}\}/gi, contact.email || '');
    }

    if (conversation?.channel) {
      result = result.replace(/\{\{canal\}\}/gi, conversation.channel.name || '');
    }

    return result;
  }
}

