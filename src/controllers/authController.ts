import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService, setAuthCookies, clearAuthCookies } from '../services/authService';
import { getCookie } from '../utils/securityHelpers';
import { auditLogService } from '../services/auditLogService';

const authService = new AuthService();

function getRequestMeta(req: AuthRequest) {
  return {
    ip: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export class AuthController {
  async register(req: AuthRequest, res: Response) {
    try {
      const { email, password, name, role, sectorIds } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
      }

      const { validatePassword } = await import('../utils/passwordPolicy');
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const allowedRoles = ['ADMIN', 'SUPERVISOR', 'AGENT'] as const;
      const safeRole = allowedRoles.includes(role) ? role : undefined;

      const user = await authService.register({ email, password, name, role: safeRole, sectorIds });

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        user,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const result = await authService.login({ email, password }, getRequestMeta(req));
      setAuthCookies(res, result.token, result.refreshToken);

      res.json({
        user: result.user,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async refresh(req: AuthRequest, res: Response) {
    try {
      const refreshToken = getCookie(req, 'refreshToken');
      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token ausente' });
      }

      const result = await authService.refreshSession(refreshToken);
      if (!result) {
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
      }

      setAuthCookies(res, result.token, result.refreshToken);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const user = await authService.getCurrentUser(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async heartbeat(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      await authService.touchHeartbeat(req.user.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async logout(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const refreshToken = getCookie(req, 'refreshToken');
      await authService.revokeRefreshToken(refreshToken);
      await authService.revokeAllUserRefreshTokens(req.user.id);
      await authService.clearPresenceOnLogout(req.user.id);
      clearAuthCookies(res);

      await auditLogService.log({
        userId: req.user.id,
        action: 'LOGOUT',
        ...getRequestMeta(req),
      });

      res.json({ message: 'Logout realizado com sucesso' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
