import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { User } from '@prisma/client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  sectorIds?: string[];
}

export class AuthService {
  async register(data: RegisterData): Promise<User> {
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

    const { password: _, sectors, ...userWithoutSensitive } = user;
    return userWithoutSensitive as User;
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new Error('Usuário inativo');
    }

    const passwordMatch = await bcrypt.compare(credentials.password, user.password);

    if (!passwordMatch) {
      throw new Error('Credenciais inválidas');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('Configuração JWT não encontrada');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: expiresIn as string,
      } as jwt.SignOptions
    );

    // Atualizar lastActiveAt ao fazer login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
      },
    });

    // Tentar redistribuir conversas não atribuídas quando um usuário faz login
    // Isso garante que conversas que ficaram sem usuário (todos offline) sejam distribuídas
    try {
      const { ConversationDistributionService } = await import('./conversationDistributionService');
      const distributionService = new ConversationDistributionService();
      await distributionService.redistributeUnassignedConversations();
    } catch (error) {
      console.error('[AuthService] Erro ao redistribuir conversas no login:', error);
      // Não bloquear o login se a redistribuição falhar
    }

    // Remove password do retorno
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      token,
    };
  }

  async getCurrentUser(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    return userWithoutPassword;
  }
}

