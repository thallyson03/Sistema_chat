import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/userService';

const userService = new UserService();

export class UserController {
  async createUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem criar usuários
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para criar usuários' });
      }

      const { email, password, name, role, sectorIds, isActive } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
      }

      const user = await userService.createUser({
        email,
        password,
        name,
        role,
        sectorIds,
        isActive,
      });

      res.status(201).json(user);
    } catch (error: any) {
      console.error('[UserController] Erro ao criar usuário:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem editar usuários, ou o próprio usuário
      const { id } = req.params;
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR' && req.user.id !== id) {
        return res.status(403).json({ error: 'Sem permissão para editar este usuário' });
      }

      const { email, name, role, sectorIds, isActive, password } = req.body;

      // Apenas admins podem alterar role e isActive
      const updateData: any = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) updateData.password = password;
      if (req.user.role === 'ADMIN' || req.user.role === 'SUPERVISOR') {
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sectorIds !== undefined) updateData.sectorIds = sectorIds;
      }

      const user = await userService.updateUser(id, updateData);

      res.json(user);
    } catch (error: any) {
      console.error('[UserController] Erro ao atualizar usuário:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins podem deletar usuários
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Sem permissão para deletar usuários' });
      }

      const { id } = req.params;

      // Não permitir deletar a si mesmo
      if (req.user.id === id) {
        return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
      }

      await userService.deleteUser(id);

      res.json({ message: 'Usuário deletado com sucesso' });
    } catch (error: any) {
      console.error('[UserController] Erro ao deletar usuário:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(user);
    } catch (error: any) {
      console.error('[UserController] Erro ao buscar usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async listUsers(req: AuthRequest, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const users = await userService.listUsers(includeInactive);

      res.json(users);
    } catch (error: any) {
      console.error('[UserController] Erro ao listar usuários:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getUserSectors(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const sectors = await userService.getUserSectors(id);

      res.json(sectors);
    } catch (error: any) {
      console.error('[UserController] Erro ao buscar setores do usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async assignUserToSector(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem atribuir setores
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para atribuir setores' });
      }

      const { id } = req.params;
      const { sectorId } = req.body;

      if (!sectorId) {
        return res.status(400).json({ error: 'ID do setor é obrigatório' });
      }

      const userSector = await userService.assignUserToSector(id, sectorId);

      res.json(userSector);
    } catch (error: any) {
      console.error('[UserController] Erro ao atribuir setor:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async removeUserFromSector(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem remover setores
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para remover setores' });
      }

      const { id } = req.params;
      const { sectorId } = req.body;

      if (!sectorId) {
        return res.status(400).json({ error: 'ID do setor é obrigatório' });
      }

      await userService.removeUserFromSector(id, sectorId);

      res.json({ message: 'Setor removido do usuário com sucesso' });
    } catch (error: any) {
      console.error('[UserController] Erro ao remover setor:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async setPause(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { id } = req.params;
      const { pause, reason, pausedUntil } = req.body;

      // Usuário só pode pausar a si mesmo, a menos que seja admin/supervisor
      if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para alterar pausa de outro usuário' });
      }

      const pausedUntilDate = pausedUntil ? new Date(pausedUntil) : undefined;

      const user = await userService.setPause(id, pause === true, reason, pausedUntilDate);

      // Se está pausando, redistribuir conversas abertas
      if (pause === true) {
        const { ConversationDistributionService } = await import('../services/conversationDistributionService');
        const distributionService = new ConversationDistributionService();
        await distributionService.redistributePausedUserConversations(id);
      }

      res.json(user);
    } catch (error: any) {
      console.error('[UserController] Erro ao alterar pausa:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getPauseStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const pauseStatus = await userService.getPauseStatus(id);

      if (!pauseStatus) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(pauseStatus);
    } catch (error: any) {
      console.error('[UserController] Erro ao buscar status de pausa:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

