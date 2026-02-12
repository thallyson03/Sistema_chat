import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// POST - Criar novo contato
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, channelId, channelIdentifier, metadata } = req.body;

    if (!name || !channelId) {
      return res.status(400).json({ error: 'Nome e channelId são obrigatórios' });
    }

    // Verificar se já existe contato com este channelIdentifier no mesmo canal
    if (channelIdentifier) {
      const existing = await prisma.contact.findFirst({
        where: {
          channelId,
          channelIdentifier,
        },
      });

      if (existing) {
        return res.json(existing);
      }
    }

    // Criar novo contato
    const contact = await prisma.contact.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        channelId,
        channelIdentifier: channelIdentifier || null,
        metadata: metadata || {},
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.status(201).json(contact);
  } catch (error: any) {
    console.error('Erro ao criar contato:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Download template XLSX (deve vir antes de /:id)
router.get('/template', async (req: AuthRequest, res) => {
  try {
    // Dados de exemplo para o template
    const rows = [
      { name: 'João Silva',  phone: '559988776655', email: 'joao@example.com' },
      { name: 'Maria Santos', phone: '559977665544', email: 'maria@example.com' },
    ];

    // Criar worksheet e workbook com XLSX
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ['name', 'phone', 'email'] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');

    // Gerar buffer em formato XLSX
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-contatos.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Listar todos os contatos
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { channelId, search, limit, offset } = req.query;

    const where: any = {};
    
    if (channelId) {
      where.channelId = channelId as string;
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
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      contacts,
      total,
      limit: take,
      offset: skip,
    });
  } catch (error: any) {
    console.error('Erro ao listar contatos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET Contact por ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
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

