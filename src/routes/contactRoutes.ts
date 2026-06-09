import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { buildContactVisibilityWhere, isContactVisibleToViewer } from '../utils/accessControl';
import { contactPrivacyService } from '../services/contactPrivacyService';
import { contactConsentService } from '../services/contactConsentService';
import { auditAction } from '../middleware/auditMiddleware';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { buildContactTemplateBuffer } from '../utils/excelWorkbook';
import { contactResolutionService } from '../services/contactResolutionService';
import { ConversationService } from '../services/conversationService';
const router = Router();
const conversationService = new ConversationService();

router.use(authenticateToken);

router.post('/', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res) => {
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

router.get('/template', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res) => {
  try {
    const rows = [
      { name: 'João Silva', phone: '559988776655', email: 'joao@example.com' },
      { name: 'Maria Santos', phone: '559977665544', email: 'maria@example.com' },
    ];

    const buffer = await buildContactTemplateBuffer(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-contatos.xlsx"');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    const { channelId, search, limit, offset } = req.query;

    const visibilityWhere = await buildContactVisibilityWhere(req.user);
    const where: any = { ...visibilityWhere };

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
    if (!req.user || !(await isContactVisibleToViewer(req.user, id))) {
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

router.get(
  '/:id/export',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  auditAction('EXPORT_CONTACT_DATA', 'contact', (req) => req.params.id),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const visibilityWhere = await buildContactVisibilityWhere(req.user!);
      const contact = await prisma.contact.findFirst({
        where: { id, ...visibilityWhere },
        select: { id: true },
      });
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      const data = await contactPrivacyService.exportContactData(id, req.user?.id);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

router.post('/:id/consent', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.user || !(await isContactVisibleToViewer(req.user, id))) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const { purpose, legalBasis, granted, source } = req.body || {};
    if (!purpose || !legalBasis) {
      return res.status(400).json({ error: 'purpose e legalBasis são obrigatórios' });
    }

    const consent = await contactConsentService.recordConsent({
      contactId: id,
      purpose,
      legalBasis,
      granted,
      source,
      recordedById: req.user?.id,
    });
    res.status(201).json(consent);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/consents', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.user || !(await isContactVisibleToViewer(req.user, id))) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const consents = await contactConsentService.listConsents(id);
    res.json({ contactId: id, consents });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/anonymize', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.user || !(await isContactVisibleToViewer(req.user, id))) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const result = await contactPrivacyService.anonymizeContact(id, req.user?.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authorizeRoles('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await contactPrivacyService.deleteContact(id, req.user?.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

    const { id } = req.params;
    const visibilityWhere = await buildContactVisibilityWhere(req.user);
    const contact = await prisma.contact.findFirst({
      where: { id, ...visibilityWhere },
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
