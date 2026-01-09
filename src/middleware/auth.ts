import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log('[Auth] authenticateToken chamado');
  console.log('[Auth] URL:', req.url);
  console.log('[Auth] Method:', req.method);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[Auth] Token não fornecido');
    return res.status(401).json({ error: 'Token de acesso não fornecido' });
  }

  console.log('[Auth] Token presente:', token.substring(0, 20) + '...');

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[Auth] JWT_SECRET não configurado');
    return res.status(500).json({ error: 'Configuração JWT não encontrada' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };
    console.log('[Auth] Token válido para usuário:', decoded.email, 'Role:', decoded.role);
    req.user = decoded;
    next();
  } catch (error: any) {
    // Token inválido ou expirado
    console.error('[Auth] Erro ao verificar token:', error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('[Auth] authorizeRoles chamado');
    console.log('[Auth] Roles permitidos:', roles);
    console.log('[Auth] User role:', req.user?.role);
    
    if (!req.user) {
      console.log('[Auth] Usuário não autenticado');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      console.log('[Auth] Acesso negado - role:', req.user.role, 'não está em:', roles);
      return res.status(403).json({ error: 'Acesso negado. Permissões insuficientes.' });
    }

    console.log('[Auth] Autorização concedida');
    next();
  };
};

