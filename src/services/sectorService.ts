import prisma from '../config/database';

export interface CreateSectorData {
  name: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export interface UpdateSectorData {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export class SectorService {
  async create(data: CreateSectorData) {
    return await prisma.sector.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#3B82F6',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(id: string, data: UpdateSectorData) {
    return await prisma.sector.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Verificar se há canais ou usuários associados
    const [channelsCount, usersCount] = await Promise.all([
      prisma.channel.count({ where: { sectorId: id } }),
      prisma.userSector.count({ where: { sectorId: id } }),
    ]);

    if (channelsCount > 0 || usersCount > 0) {
      throw new Error(
        `Não é possível deletar o setor. Existem ${channelsCount} canal(is) e ${usersCount} usuário(s) associados.`
      );
    }

    return await prisma.sector.delete({
      where: { id },
    });
  }

  async getById(id: string) {
    return await prisma.sector.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            channels: true,
            users: true,
          },
        },
      },
    });
  }

  async list(includeInactive: boolean = false) {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return await prisma.sector.findMany({
      where,
      include: {
        _count: {
          select: {
            channels: true,
            users: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
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

  async updateUserSectors(userId: string, sectorIds: string[]) {
    // Remover todos os setores atuais do usuário
    await prisma.userSector.deleteMany({
      where: { userId },
    });

    // Adicionar os novos setores
    if (sectorIds.length > 0) {
      await prisma.userSector.createMany({
        data: sectorIds.map((sectorId) => ({
          userId,
          sectorId,
        })),
      });
    }

    return await this.getUserSectors(userId);
  }
}

