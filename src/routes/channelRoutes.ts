import { Router } from 'express';
import { ChannelController } from '../controllers/channelController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { createChannelSchema, updateChannelSchema } from '../schemas/channelSchemas';

const router = Router();
const channelController = new ChannelController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// Rotas de leitura de canais (qualquer usuário autenticado)
router.get('/', channelController.getChannels.bind(channelController));
router.get('/health/panel', channelController.getHealthPanel.bind(channelController));
router.get('/check/whatsapp-official', channelController.checkWhatsAppOfficial.bind(channelController));
router.get('/:id', channelController.getChannelById.bind(channelController));
router.get('/:id/qrcode', channelController.getQRCode.bind(channelController));
router.get('/:id/status', channelController.getStatus.bind(channelController));

// Rotas sensíveis de escrita em canais (apenas ADMIN/SUPERVISOR)
router.post(
  '/',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  validateBody(createChannelSchema),
  channelController.createChannel.bind(channelController),
);
router.post(
  '/:id/webhook',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  channelController.configureWebhook.bind(channelController)
);
router.post(
  '/:id/cancel-pairing',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  channelController.cancelPairing.bind(channelController)
);
router.put(
  '/:id',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  validateBody(updateChannelSchema),
  channelController.updateChannel.bind(channelController),
);
// Exclusão de canais apenas para ADMIN
router.delete(
  '/:id',
  authorizeRoles('ADMIN'),
  channelController.deleteChannel.bind(channelController)
);

export default router;
