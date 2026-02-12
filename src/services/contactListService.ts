import prisma from '../config/database';
import { JourneyExecutionService } from './journeyExecutionService';

const journeyExecutionService = new JourneyExecutionService();

export class ContactListService {
  /**
   * Dispara jornadas quando um contato é adicionado a uma lista
   */
  private async triggerJourneysForList(listId: string, contactId: string) {
    try {
      // Buscar todas as jornadas ativas com trigger "list_added" para esta lista
      const journeys = await prisma.journey.findMany({
        where: {
          status: 'ACTIVE',
        },
        include: {
          nodes: {
            where: {
              type: 'TRIGGER',
            },
          },
        },
      });

      for (const journey of journeys) {
        const triggerNode = journey.nodes.find(
          (n: any) => n.type === 'TRIGGER' && 
          (n.config as any)?.triggerType === 'list_added' &&
          (n.config as any)?.listId === listId
        );

        if (triggerNode) {
          console.log(`[ContactListService] Disparando jornada ${journey.id} para contato ${contactId} adicionado à lista ${listId}`);
          await journeyExecutionService.executeJourneyForContact(journey.id, contactId);
        }
      }
    } catch (error: any) {
      console.error(`[ContactListService] Erro ao disparar jornadas para lista ${listId}:`, error);
      // Não bloquear a adição do contato se houver erro nas jornadas
    }
  }
  async createList(data: { name: string; description?: string; color?: string }) {
    const list = await prisma.contactList.create({
      data: {
        name: data.name,
        description: data.description || null,
        color: data.color || '#3B82F6',
      },
    });
    return list;
  }

  async getLists() {
    const lists = await prisma.contactList.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
    return lists;
  }

  async getListById(id: string) {
    const list = await prisma.contactList.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            contact: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    return list;
  }

  async updateList(id: string, data: { name?: string; description?: string; color?: string }) {
    const list = await prisma.contactList.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
      },
    });
    return list;
  }

  async deleteList(id: string) {
    // Deletar membros primeiro (onDelete: Cascade)
    await prisma.contactListMember.deleteMany({
      where: { listId: id },
    });
    await prisma.contactList.delete({
      where: { id },
    });
  }

  async addContactsToList(listId: string, contactIds: string[], addedById?: string) {
    const list = await prisma.contactList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      throw new Error('Lista não encontrada');
    }

    let addedCount = 0;

    for (const contactId of contactIds) {
      try {
        await prisma.contactListMember.create({
          data: {
            listId,
            contactId,
            addedById: addedById || null,
          },
        });
        addedCount++;

        // Verificar se há jornadas ativas com trigger "list_added" para esta lista
        await this.triggerJourneysForList(listId, contactId);
      } catch (e: any) {
        // Ignorar duplicatas (unique constraint listId+contactId)
        if (!e.message?.includes('Unique constraint')) {
          console.error('Erro ao adicionar contato à lista:', e);
        }
      }
    }

    return { addedCount, total: contactIds.length };
  }

  async removeContactsFromList(listId: string, contactIds: string[]) {
    await prisma.contactListMember.deleteMany({
      where: {
        listId,
        contactId: { in: contactIds },
      },
    });
  }

  async getContactsInList(listId: string, limit?: number, offset?: number) {
    const members = await prisma.contactListMember.findMany({
      where: { listId },
      include: {
        contact: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.contactListMember.count({
      where: { listId },
    });

    return {
      members,
      total,
      limit: limit || total,
      offset: offset || 0,
    };
  }
}

