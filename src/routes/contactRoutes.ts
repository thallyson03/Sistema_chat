import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';
import { contactResolutionService } from '../services/contactResolutionService';
import { ConversationService } from '../services/conversationService';
const router = Router();
const conversationService = new ConversationService();

router.use(authenticateToken);

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, channelId, metadata } = req.body;

    if (!name || !phone || !channelId) {
      return res.status(400).json({ error: 'Nome, telefone e channelId são obrigatórios' });
    }

    const contact = await contactResolutionService.resolveContactByPhone({
      phone,
      name,
      channelId,
      externalId: phone,
      provider: null,
    });

    if (email) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { email },
      });
    }

    if (metadata && typeof metadata === 'object') {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { metadata },
      });
    }

    const full = await prisma.contact.findUnique({
      where: { id: contact.id },
      include: {
        channelIdentities: {
          include: {
            channel: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });

    res.status(201).json(full);
  } catch (error: any) {
    console.error('Erro ao criar contato:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/template', async (req: AuthRequest, res) => {
  try {
    const rows = [
      { name: 'João Silva', phone: '559988776655', email: 'joao@example.com' },
      { name: 'Maria Santos', phone: '559977665544', email: 'maria@example.com' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ['name', 'phone', 'email'] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-contatos.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { channelId, search, limit, offset } = req.query;

    const where: any = {};

    if (channelId) {
      where.channelIdentities = {
        some: { channelId: channelId as string },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const take = limit ? parseInt(limit as string) : 100;
    const skip = offset ? parseInt(offset as string) : 0;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          channelIdentities: {
            include: {
              channel: { select: { id: true, name: true, type: true } },
            },
          },
          _count: { select: { conversations: true } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ contacts, total, limit: take, offset: skip });
  } catch (error: any) {
    console.error('Erro ao listar contatos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/conversations', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const conversations = await conversationService.getContactConversations(id, {
      id: req.user!.id,
      role: req.user!.role,
    });

    res.json({ contactId: id, conversations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        channelIdentities: {
          include: {
            channel: { select: { id: true, name: true, type: true, status: true } },
          },
        },
        _count: { select: { conversations: true, deals: true } },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
