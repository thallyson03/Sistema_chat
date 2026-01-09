import { Router } from 'express';
import { MessageController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const messageController = new MessageController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post('/', messageController.sendMessage.bind(messageController));
router.get('/conversation/:conversationId', messageController.getMessages.bind(messageController));
router.put('/conversation/:conversationId/read', messageController.markAsRead.bind(messageController));

export default router;



