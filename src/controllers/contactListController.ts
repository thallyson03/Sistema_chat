import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ContactListService } from '../services/contactListService';

const contactListService = new ContactListService();

export class ContactListController {
  async createList(req: AuthRequest, res: Response) {
    try {
      const { name, description, color } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nome da lista é obrigatório' });
      }

      const list = await contactListService.createList({
        name: name.trim(),
        description,
        color,
      });

      res.status(201).json(list);
    } catch (error: any) {
      console.error('Erro ao criar lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLists(req: AuthRequest, res: Response) {
    try {
      const lists = await contactListService.getLists();
      res.json(lists);
    } catch (error: any) {
      console.error('Erro ao listar listas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getListById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const list = await contactListService.getListById(id);

      if (!list) {
        return res.status(404).json({ error: 'Lista não encontrada' });
      }

      res.json(list);
    } catch (error: any) {
      console.error('Erro ao buscar lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateList(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, color } = req.body;

      const list = await contactListService.updateList(id, {
        name,
        description,
        color,
      });

      res.json(list);
    } catch (error: any) {
      console.error('Erro ao atualizar lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteList(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await contactListService.deleteList(id);
      res.json({ message: 'Lista deletada com sucesso' });
    } catch (error: any) {
      console.error('Erro ao deletar lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addContacts(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds é obrigatório e deve conter pelo menos um ID' });
      }

      const result = await contactListService.addContactsToList(
        id,
        contactIds,
        req.user?.id
      );

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao adicionar contatos à lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async removeContacts(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds é obrigatório e deve conter pelo menos um ID' });
      }

      await contactListService.removeContactsFromList(id, contactIds);
      res.json({ message: 'Contatos removidos com sucesso' });
    } catch (error: any) {
      console.error('Erro ao remover contatos da lista:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getContacts(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const result = await contactListService.getContactsInList(
        id,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar contatos da lista:', error);
      res.status(500).json({ error: error.message });
    }
  }
}


