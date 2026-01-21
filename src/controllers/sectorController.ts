import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SectorService } from '../services/sectorService';

const sectorService = new SectorService();

export class SectorController {
  async create(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem criar setores
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para criar setores' });
      }

      const { name, description, color, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }

      const sector = await sectorService.create({
        name,
        description,
        color,
        isActive,
      });

      res.status(201).json(sector);
    } catch (error: any) {
      console.error('[SectorController] Erro ao criar setor:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins e supervisores podem editar setores
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Sem permissão para editar setores' });
      }

      const { id } = req.params;
      const { name, description, color, isActive } = req.body;

      const sector = await sectorService.update(id, {
        name,
        description,
        color,
        isActive,
      });

      res.json(sector);
    } catch (error: any) {
      console.error('[SectorController] Erro ao atualizar setor:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Apenas admins podem deletar setores
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Sem permissão para deletar setores' });
      }

      const { id } = req.params;

      await sectorService.delete(id);

      res.json({ message: 'Setor deletado com sucesso' });
    } catch (error: any) {
      console.error('[SectorController] Erro ao deletar setor:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const sector = await sectorService.getById(id);

      if (!sector) {
        return res.status(404).json({ error: 'Setor não encontrado' });
      }

      res.json(sector);
    } catch (error: any) {
      console.error('[SectorController] Erro ao buscar setor:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';

      const sectors = await sectorService.list(includeInactive);

      res.json(sectors);
    } catch (error: any) {
      console.error('[SectorController] Erro ao listar setores:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

