import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/authService';

const authService = new AuthService();

export class AuthController {
  async register(req: AuthRequest, res: Response) {
    try {
      const { email, password, name, role, sectorIds } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
      }

      const user = await authService.register({ email, password, name, role, sectorIds });

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

      const result = await authService.login({ email, password });

      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
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

  async logout(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Marcar usuário como offline (lastActiveAt = null ou data antiga)
      // Não vamos deletar lastActiveAt, apenas não atualizar mais
      // O middleware de atividade para de atualizar quando o usuário não faz requisições
      
      res.json({ message: 'Logout realizado com sucesso' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}







