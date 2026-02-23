import { Router } from 'express';
import { ChannelController } from '../controllers/channelController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const channelController = new ChannelController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// Rotas de canais
router.get('/', channelController.getChannels.bind(channelController));
router.get('/check/whatsapp-official', channelController.checkWhatsAppOfficial.bind(channelController));
router.get('/:id', channelController.getChannelById.bind(channelController));
router.get('/:id/qrcode', channelController.getQRCode.bind(channelController));
router.get('/:id/status', channelController.getStatus.bind(channelController));
router.post('/', channelController.createChannel.bind(channelController));
router.post('/:id/webhook', channelController.configureWebhook.bind(channelController));
router.put('/:id', channelController.updateChannel.bind(channelController));
router.delete('/:id', channelController.deleteChannel.bind(channelController));

export default router;
