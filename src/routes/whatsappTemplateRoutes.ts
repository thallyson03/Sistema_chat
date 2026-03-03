import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { WhatsAppOfficialService } from '../services/whatsappOfficialService';
import { getWhatsAppOfficialService } from '../config/whatsappOfficial';

const router = Router();

// Todas as rotas de template exigem usuário autenticado (e, por padrão, ADMIN/SUPERVISOR)
router.use(authenticateToken);

/**
 * Resolve o serviço do WhatsApp Official para um canal específico,
 * usando as credenciais salvas no canal. Se nenhum canalId for informado,
 * opcionalmente usa a configuração global do .env (fallback).
 */
async function getServiceForChannel(channelId?: string | null) {
  if (channelId) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error('Canal não encontrado');
    }

    const config = (channel.config || {}) as any;
    const isOfficial =
      config.provider === 'whatsapp_official' &&
      !!config.token &&
      !!config.phoneNumberId &&
      !!config.businessAccountId;

    if (!isOfficial) {
      throw new Error('Canal não está configurado para WhatsApp Official');
    }

    return new WhatsAppOfficialService({
      token: config.token,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
    });
  }

  // Fallback: usar serviço global se disponível
  const globalService = getWhatsAppOfficialService();
  if (!globalService) {
    throw new Error(
      'Serviço WhatsApp Official não configurado. Informe um canalId com credenciais válidas ou configure as variáveis de ambiente.',
    );
  }
  return globalService;
}

/**
 * Lista templates de mensagem cadastrados na WABA
 */
router.get('/', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const channelId = (req.query.channelId as string) || undefined;
    const whatsappService = await getServiceForChannel(channelId);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const after = (req.query.after as string) || undefined;

    const data = await whatsappService.listTemplates(limit, after);

    return res.json(data);
  } catch (error: any) {
    console.error('[WhatsAppTemplates] ❌ Erro ao listar templates:', error.message);
    return res.status(500).json({
      error: 'Erro ao listar templates de mensagem',
      details: error.message,
    });
  }
});

/**
 * Envia um template de mensagem para uma conversa específica (fora da janela de 24h)
 */
router.post(
  '/send',
  authorizeRoles('ADMIN', 'SUPERVISOR', 'AGENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId, templateName, language, components, channelId } = req.body || {};

      if (!conversationId || !templateName || !language) {
        return res.status(400).json({
          error: 'Campos obrigatórios: conversationId, templateName, language',
        });
      }

      // Buscar conversa com canal e contato
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          channel: true,
          contact: true,
        },
      });

      if (!conversation || !conversation.channel || !conversation.contact) {
        return res.status(404).json({
          error: 'Conversa, canal ou contato não encontrados',
        });
      }

      const effectiveChannelId = channelId || conversation.channelId;
      const service = await getServiceForChannel(effectiveChannelId);

      const phoneRaw = conversation.contact.phone;
      if (!phoneRaw) {
        return res.status(400).json({
          error: 'Contato não possui telefone configurado',
        });
      }

      const cleanPhone = phoneRaw.replace(/\D/g, '');
      const to = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      console.log('[WhatsAppTemplates] 📤 Enviando template via API Oficial:', {
        conversationId,
        contactId: conversation.contactId,
        to,
        templateName,
        language,
      });

      const result = await service.sendTemplateMessage({
        to,
        templateName,
        language,
        components,
      });

      // Registrar mensagem no banco como TEXT com metadata de template
      const createdMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: req.user?.id || null,
          content: `[TEMPLATE] ${templateName}`,
          type: 'TEXT',
          status: 'SENT',
          externalId: result.messageId || null,
          metadata: {
            templateName,
            language,
            components,
            provider: 'whatsapp_official',
            kind: 'template',
          },
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastAgentMessageAt: new Date(),
        },
      });

      return res.status(201).json({
        success: true,
        messageId: createdMessage.id,
        externalId: result.messageId,
      });
    } catch (error: any) {
      console.error('[WhatsAppTemplates] ❌ Erro ao enviar template:', error.message);
      return res.status(500).json({
        error: 'Erro ao enviar template de mensagem',
        details: error.message,
      });
    }
  },
);

/**
 * Cria um novo template simples (apenas BODY) na WABA
 */
router.post('/', authorizeRoles('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const { name, category, language, body, channelId } = req.body || {};

    if (!name || !category || !language || !body) {
      return res.status(400).json({
        error: 'Campos obrigatórios: name, category, language, body',
      });
    }

    const whatsappService = await getServiceForChannel(channelId);

    const data = await whatsappService.createTemplate({
      name,
      category,
      language,
      body,
    });

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('[WhatsAppTemplates] ❌ Erro ao criar template:', error.message);
    return res.status(500).json({
      error: 'Erro ao criar template de mensagem',
      details: error.message,
    });
  }
});

/**
 * Remove um template de mensagem (por nome + idioma)
 */
router.delete(
  '/:name',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  async (req: Request, res: Response) => {
    try {
      const name = req.params.name;
      const language = (req.query.language as string) || 'pt_BR';
      const channelId = (req.query.channelId as string) || undefined;

      if (!name) {
        return res.status(400).json({
          error: 'Parâmetro obrigatório: name',
        });
      }

      const whatsappService = await getServiceForChannel(channelId);

      const data = await whatsappService.deleteTemplate(name, language);

      return res.json(data);
    } catch (error: any) {
      console.error('[WhatsAppTemplates] ❌ Erro ao remover template:', error.message);
      return res.status(500).json({
        error: 'Erro ao remover template de mensagem',
        details: error.message,
      });
    }
  },
);

export default router;

