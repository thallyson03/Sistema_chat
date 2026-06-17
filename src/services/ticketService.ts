import prisma from '../config/database';
import { Priority, TicketStatus } from '@prisma/client';
import { ConversationService, ConversationViewer } from './conversationService';
import { generateTicketProtocol } from '../utils/ticketProtocol';

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  assignedToId?: string;
  sectorId?: string;
  search?: string;
  conversationId?: string;
  protocol?: string;
}

const ticketInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true },
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
  sector: {
    select: { id: true, name: true, color: true },
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

  private async getViewerSectorIds(viewer: ConversationViewer): Promise<string[]> {
    const userSectors = await prisma.userSector.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    return userSectors.map((s) => s.sectorId);
  }

  private async buildTicketWhere(filters: TicketFilters, viewer?: ConversationViewer) {
    const andConditions: any[] = [];

    if (!viewer) {
      // Chamadas internas (jornadas, etc.)
    } else if (viewer.role === 'ADMIN') {
      // Admin vê tudo
    } else if (!viewer.id) {
      andConditions.push({ id: '__no_access__' });
    } else {
      const sectorIds = await this.getViewerSectorIds(viewer);
      const conversationVisibility = await this.conversationService.getVisibilityWhere(viewer);

      if (sectorIds.length === 0) {
        andConditions.push({
          OR: [{ assignedToId: viewer.id }],
        });
      } else {
        andConditions.push({
          OR: [
            { conversation: conversationVisibility },
            {
              conversationId: null,
              OR: [
                { assignedToId: viewer.id },
                { sectorId: { in: sectorIds } },
                { sectorId: null },
              ],
            },
          ],
        });
      }
    }

    if (filters.status) andConditions.push({ status: filters.status });
    if (filters.priority) andConditions.push({ priority: filters.priority });
    if (filters.assignedToId) andConditions.push({ assignedToId: filters.assignedToId });
    if (filters.conversationId) andConditions.push({ conversationId: filters.conversationId });
    if (filters.sectorId) {
      andConditions.push({
        OR: [{ sectorId: filters.sectorId }, { conversation: { sectorId: filters.sectorId } }],
      });
    }
    if (filters.protocol?.trim()) {
      andConditions.push({ protocol: filters.protocol.trim().padStart(4, '0') });
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      andConditions.push({
        OR: [
          { protocol: { contains: q } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { requesterName: { contains: q, mode: 'insensitive' } },
          { requesterPhone: { contains: q } },
          { requesterEmail: { contains: q, mode: 'insensitive' } },
          { contact: { name: { contains: q, mode: 'insensitive' } } },
          { contact: { phone: { contains: q } } },
          { conversation: { contact: { name: { contains: q, mode: 'insensitive' } } } },
          { conversation: { contact: { phone: { contains: q } } } },
        ],
      });
    }

    return andConditions.length > 0 ? { AND: andConditions } : {};
  }

  async canViewerAccessTicket(ticketId: string, viewer?: ConversationViewer): Promise<boolean> {
    if (!viewer) return true;
    if (viewer.role === 'ADMIN') return true;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) return false;

    const where = await this.buildTicketWhere({}, viewer);
    const count = await prisma.ticket.count({
      where: { id: ticketId, ...where },
    });
    return count > 0;
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

    return prisma.ticket.findFirst({
      where: { conversationId },
      include: ticketInclude,
    });
  }

  private async resolveRequesterData(data: {
    contactId?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    requesterEmail?: string | null;
  }) {
    if (!data.contactId) {
      return {
        contactId: null,
        requesterName: data.requesterName?.trim() || null,
        requesterPhone: data.requesterPhone?.trim() || null,
        requesterEmail: data.requesterEmail?.trim() || null,
      };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!contact) {
      throw new Error('Contato não encontrado');
    }

    return {
      contactId: contact.id,
      requesterName: data.requesterName?.trim() || contact.name,
      requesterPhone: data.requesterPhone?.trim() || contact.phone,
      requesterEmail: data.requesterEmail?.trim() || contact.email,
    };
  }

  async create(
    data: {
      conversationId?: string | null;
      contactId?: string | null;
      requesterName?: string | null;
      requesterPhone?: string | null;
      requesterEmail?: string | null;
      sectorId?: string | null;
      title: string;
      description?: string | null;
      priority?: Priority;
      assignedToId?: string | null;
    },
    viewer?: ConversationViewer,
  ) {
    const conversationId = data.conversationId?.trim() || null;

    if (conversationId) {
      const canAccess = await this.conversationService.canViewerAccessConversation(
        conversationId,
        viewer,
      );
      if (!canAccess) {
        throw new Error('Acesso negado para esta conversa');
      }

      const existing = await prisma.ticket.findFirst({
        where: { conversationId },
        select: { id: true, protocol: true },
      });
      if (existing) {
        throw new Error(`Já existe o ticket #${existing.protocol} para esta conversa`);
      }
    } else {
      const hasRequester =
        data.contactId ||
        data.requesterName?.trim() ||
        data.requesterPhone?.trim();
      if (!hasRequester) {
        throw new Error('Informe conversa ou dados do solicitante (nome ou telefone)');
      }
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

    if (data.sectorId) {
      const sector = await prisma.sector.findFirst({
        where: { id: data.sectorId, isActive: true },
        select: { id: true },
      });
      if (!sector) {
        throw new Error('Setor não encontrado');
      }
    }

    const requester = await this.resolveRequesterData(data);

    return prisma.$transaction(async (tx) => {
      const protocol = await generateTicketProtocol(tx);

      let sectorId = data.sectorId || null;
      if (conversationId && !sectorId) {
        const conv = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: { sectorId: true },
        });
        sectorId = conv?.sectorId || null;
      }

      return tx.ticket.create({
        data: {
          protocol,
          conversationId,
          contactId: requester.contactId,
          requesterName: requester.requesterName,
          requesterPhone: requester.requesterPhone,
          requesterEmail: requester.requesterEmail,
          sectorId,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          priority: data.priority || Priority.MEDIUM,
          assignedToId: data.assignedToId || null,
          status: TicketStatus.OPEN,
        },
        include: ticketInclude,
      });
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
      requesterName?: string | null;
      requesterPhone?: string | null;
      requesterEmail?: string | null;
      sectorId?: string | null;
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
    if (data.requesterName !== undefined) updateData.requesterName = data.requesterName?.trim() || null;
    if (data.requesterPhone !== undefined) updateData.requesterPhone = data.requesterPhone?.trim() || null;
    if (data.requesterEmail !== undefined) updateData.requesterEmail = data.requesterEmail?.trim() || null;
    if (data.sectorId !== undefined) updateData.sectorId = data.sectorId;

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
