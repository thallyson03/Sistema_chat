import prisma from '../config/database';
import { Priority, TicketStatus } from '@prisma/client';
import { ConversationService, ConversationViewer } from './conversationService';

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  assignedToId?: string;
  sectorId?: string;
  search?: string;
  conversationId?: string;
}

const ticketInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  conversation: {
    select: {
      id: true,
      status: true,
      priority: true,
      sectorId: true,
      channelId: true,
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          profilePicture: true,
        },
      },
      channel: {
        select: { id: true, name: true, type: true },
      },
      sector: {
        select: { id: true, name: true, color: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  },
} as const;

export class TicketService {
  private conversationService = new ConversationService();

  private async buildTicketWhere(filters: TicketFilters, viewer?: ConversationViewer) {
    const visibilityWhere = await this.conversationService.getVisibilityWhere(viewer);
    const andConditions: any[] = [{ conversation: visibilityWhere }];

    if (filters.status) {
      andConditions.push({ status: filters.status });
    }
    if (filters.priority) {
      andConditions.push({ priority: filters.priority });
    }
    if (filters.assignedToId) {
      andConditions.push({ assignedToId: filters.assignedToId });
    }
    if (filters.conversationId) {
      andConditions.push({ conversationId: filters.conversationId });
    }
    if (filters.sectorId) {
      andConditions.push({ conversation: { sectorId: filters.sectorId } });
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { conversation: { contact: { name: { contains: q, mode: 'insensitive' } } } },
          { conversation: { contact: { phone: { contains: q } } } },
        ],
      });
    }

    return { AND: andConditions };
  }

  async canViewerAccessTicket(ticketId: string, viewer?: ConversationViewer): Promise<boolean> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { conversationId: true },
    });
    if (!ticket) return false;
    return this.conversationService.canViewerAccessConversation(ticket.conversationId, viewer);
  }

  async list(filters: TicketFilters, limit: number, offset: number, viewer?: ConversationViewer) {
    const where = await this.buildTicketWhere(filters, viewer);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total, limit, offset };
  }

  async getStats(viewer?: ConversationViewer) {
    const where = await this.buildTicketWhere({}, viewer);
    const [total, byStatus] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    ) as Record<TicketStatus, number>;

    return {
      total,
      open: statusCounts.OPEN || 0,
      inProgress: statusCounts.IN_PROGRESS || 0,
      resolved: statusCounts.RESOLVED || 0,
      closed: statusCounts.CLOSED || 0,
    };
  }

  async getById(id: string, viewer?: ConversationViewer) {
    const canAccess = await this.canViewerAccessTicket(id, viewer);
    if (!canAccess) return null;

    return prisma.ticket.findUnique({
      where: { id },
      include: ticketInclude,
    });
  }

  async getByConversationId(conversationId: string, viewer?: ConversationViewer) {
    const canAccess = await this.conversationService.canViewerAccessConversation(
      conversationId,
      viewer,
    );
    if (!canAccess) return null;

    return prisma.ticket.findUnique({
      where: { conversationId },
      include: ticketInclude,
    });
  }

  async create(
    data: {
      conversationId: string;
      title: string;
      description?: string | null;
      priority?: Priority;
      assignedToId?: string | null;
    },
    viewer?: ConversationViewer,
  ) {
    const canAccess = await this.conversationService.canViewerAccessConversation(
      data.conversationId,
      viewer,
    );
    if (!canAccess) {
      throw new Error('Acesso negado para esta conversa');
    }

    const existing = await prisma.ticket.findUnique({
      where: { conversationId: data.conversationId },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Já existe um ticket para esta conversa');
    }

    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, isActive: true },
        select: { id: true },
      });
      if (!user) {
        throw new Error('Responsável não encontrado');
      }
    }

    return prisma.ticket.create({
      data: {
        conversationId: data.conversationId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        priority: data.priority || Priority.MEDIUM,
        assignedToId: data.assignedToId || null,
        status: TicketStatus.OPEN,
      },
      include: ticketInclude,
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: Priority;
      status?: TicketStatus;
      assignedToId?: string | null;
    },
    viewer?: ConversationViewer,
  ) {
    const ticket = await this.getById(id, viewer);
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }

    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, isActive: true },
        select: { id: true },
      });
      if (!user) {
        throw new Error('Responsável não encontrado');
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === TicketStatus.CLOSED || data.status === TicketStatus.RESOLVED) {
        updateData.closedAt = new Date();
      } else if (data.status === TicketStatus.OPEN || data.status === TicketStatus.IN_PROGRESS) {
        updateData.closedAt = null;
      }
    }

    return prisma.ticket.update({
      where: { id },
      data: updateData,
      include: ticketInclude,
    });
  }

  async assign(id: string, assignedToId: string | null, viewer?: ConversationViewer) {
    const ticket = await this.getById(id, viewer);
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }

    if (assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: assignedToId, isActive: true },
        select: { id: true },
      });
      if (!user) {
        throw new Error('Responsável não encontrado');
      }
    }

    const status =
      ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.RESOLVED
        ? ticket.status
        : assignedToId
          ? TicketStatus.IN_PROGRESS
          : TicketStatus.OPEN;

    return prisma.ticket.update({
      where: { id },
      data: {
        assignedToId,
        status,
        closedAt:
          status === TicketStatus.CLOSED || status === TicketStatus.RESOLVED
            ? ticket.closedAt
            : null,
      },
      include: ticketInclude,
    });
  }

  async close(id: string, resolutionNote?: string | null, viewer?: ConversationViewer) {
    const ticket = await this.getById(id, viewer);
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error('Ticket já está encerrado');
    }

    const description =
      resolutionNote?.trim() &&
      ticket.description?.trim() !== resolutionNote.trim()
        ? [ticket.description, `Encerramento: ${resolutionNote.trim()}`]
            .filter(Boolean)
            .join('\n\n')
        : ticket.description;

    return prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
        description,
      },
      include: ticketInclude,
    });
  }

  async reopen(id: string, viewer?: ConversationViewer) {
    const ticket = await this.getById(id, viewer);
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }
    if (ticket.status !== TicketStatus.CLOSED && ticket.status !== TicketStatus.RESOLVED) {
      throw new Error('Apenas tickets encerrados ou resolvidos podem ser reabertos');
    }

    return prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.OPEN,
        closedAt: null,
      },
      include: ticketInclude,
    });
  }

  async delete(id: string, viewer?: ConversationViewer) {
    const ticket = await this.getById(id, viewer);
    if (!ticket) {
      throw new Error('Ticket não encontrado');
    }

    await prisma.ticket.delete({ where: { id } });
    return { message: 'Ticket excluído com sucesso' };
  }
}
