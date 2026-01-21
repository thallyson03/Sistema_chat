import prisma from '../config/database';
import bcrypt from 'bcryptjs';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  sectorIds?: string[];
  isActive?: boolean;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  sectorIds?: string[];
  isActive?: boolean;
  password?: string;
}

export class UserService {
  async createUser(data: CreateUserData): Promise<any> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Usuário já existe com este email');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'AGENT',
        isActive: data.isActive !== undefined ? data.isActive : true,
        sectors: data.sectorIds && data.sectorIds.length > 0
          ? {
              create: data.sectorIds.map((sectorId) => ({
                sectorId,
              })),
            }
          : undefined,
      },
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as any;
  }

  async updateUser(id: string, data: UpdateUserData): Promise<any> {
    const updateData: any = {};

    if (data.email) updateData.email = data.email;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Atualizar setores se fornecido
    if (data.sectorIds !== undefined) {
      // Remover todos os setores atuais
      await prisma.userSector.deleteMany({
        where: { userId: id },
      });

      // Adicionar os novos setores
      if (data.sectorIds.length > 0) {
        await prisma.userSector.createMany({
          data: data.sectorIds.map((sectorId) => ({
            userId: id,
            sectorId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as any;
  }

  async deleteUser(id: string): Promise<void> {
    // Verificar se há conversas ou tickets atribuídos
    const [conversationsCount, ticketsCount] = await Promise.all([
      prisma.conversation.count({ where: { assignedToId: id } }),
      prisma.ticket.count({ where: { assignedToId: id } }),
    ]);

    if (conversationsCount > 0 || ticketsCount > 0) {
      throw new Error(
        `Não é possível deletar o usuário. Existem ${conversationsCount} conversa(s) e ${ticketsCount} ticket(s) atribuídos.`
      );
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  async getUserById(id: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as any;
  }

  async listUsers(includeInactive: boolean = false) {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
        _count: {
          select: {
            assignedConversations: true,
            assignedTickets: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return users.map((user) => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async assignUserToSector(userId: string, sectorId: string) {
    // Verificar se já existe
    const existing = await prisma.userSector.findUnique({
      where: {
        userId_sectorId: {
          userId,
          sectorId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.userSector.create({
      data: {
        userId,
        sectorId,
      },
      include: {
        sector: true,
      },
    });
  }

  async removeUserFromSector(userId: string, sectorId: string) {
    return await prisma.userSector.delete({
      where: {
        userId_sectorId: {
          userId,
          sectorId,
        },
      },
    });
  }

  async getUserSectors(userId: string) {
    const userSectors = await prisma.userSector.findMany({
      where: { userId },
      include: {
        sector: true,
      },
    });

    return userSectors.map((us) => us.sector);
  }

  async setPause(userId: string, pause: boolean, reason?: string, pausedUntil?: Date) {
    const updateData: any = {
      isPaused: pause,
      pausedAt: pause ? new Date() : null,
      pausedUntil: pausedUntil || null,
      pauseReason: reason || null,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        sectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getPauseStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isPaused: true,
        pausedAt: true,
        pausedUntil: true,
        pauseReason: true,
      },
    });

    return user;
  }
}

