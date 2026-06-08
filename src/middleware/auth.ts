import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { getCookie } from '../utils/securityHelpers';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookieToken = getCookie(req, 'accessToken');
  return cookieToken || null;
}

async function resolveAuthenticatedUser(token: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET_NOT_CONFIGURED');
  }

  const decoded = jwt.verify(token, jwtSecret) as {
    id: string;
    email: string;
    role: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso não fornecido' });
  }

  try {
    const user = await resolveAuthenticatedUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    req.user = user;

    prisma.user
      .update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {});

    next();
  } catch (error: any) {
    if (error?.message === 'JWT_SECRET_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Configuração JWT não encontrada' });
    }
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
};

/** Autenticação opcional — popula req.user se token válido, mas não bloqueia. */
export const optionalAuthenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const user = await resolveAuthenticatedUser(token);
    if (user) req.user = user;
  } catch (_) {
    // ignora token inválido em rotas opcionais
  }
  next();
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Permissões insuficientes.' });
    }

    next();
  };
};
