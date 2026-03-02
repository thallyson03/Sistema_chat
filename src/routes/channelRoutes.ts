import { Router } from 'express';
import { ChannelController } from '../controllers/channelController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();
const channelController = new ChannelController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// Rotas de leitura de canais (qualquer usuário autenticado)
router.get('/', channelController.getChannels.bind(channelController));
router.get('/check/whatsapp-official', channelController.checkWhatsAppOfficial.bind(channelController));
router.get('/:id', channelController.getChannelById.bind(channelController));
router.get('/:id/qrcode', channelController.getQRCode.bind(channelController));
router.get('/:id/status', channelController.getStatus.bind(channelController));

// Rotas sensíveis de escrita em canais (apenas ADMIN/SUPERVISOR)
router.post(
  '/',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  channelController.createChannel.bind(channelController)
);
router.post(
  '/:id/webhook',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  channelController.configureWebhook.bind(channelController)
);
router.put(
  '/:id',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  channelController.updateChannel.bind(channelController)
);
// Exclusão de canais apenas para ADMIN
router.delete(
  '/:id',
  authorizeRoles('ADMIN'),
  channelController.deleteChannel.bind(channelController)
);

export default router;
