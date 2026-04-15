import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  getTicketPortalUrlForUserId,
  isTicketPortalConfigured,
} from '../services/externalTicketSystemService';

const router = Router();

router.get('/portal', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!isTicketPortalConfigured()) {
      return res.status(503).json({
        error: 'Integração de tickets não configurada',
        hint: 'Defina EXTERNAL_TICKET_SSO_SHARED_SECRET + EXTERNAL_TICKET_API_BASE_URL (ou EXTERNAL_TICKET_PORTAL_URL para fallback).',
      });
    }
    const url = await getTicketPortalUrlForUserId(req.user.id);
    if (!url) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    return res.json({ url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao montar URL do portal';
    console.error('[ticketPortalRoutes]', msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;
