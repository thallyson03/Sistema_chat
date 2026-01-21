import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../config/database';

/**
 * Middleware para atualizar lastActiveAt do usuário a cada requisição
 * Considera o usuário online se fez requisição nos últimos 5 minutos
 */
export async function trackUserActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.id) {
      // Atualizar lastActiveAt em background (não bloquear a requisição)
      prisma.user
        .update({
          where: { id: req.user.id },
          data: {
            lastActiveAt: new Date(),
          },
        })
        .catch((error) => {
          console.error('[ActivityTracker] Erro ao atualizar lastActiveAt:', error);
        });
    }
  } catch (error) {
    // Não bloquear a requisição se houver erro
    console.error('[ActivityTracker] Erro:', error);
  }

  next();
}

