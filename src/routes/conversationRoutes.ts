import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const conversationController = new ConversationController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.get('/', conversationController.getConversations.bind(conversationController));
router.get('/stats', conversationController.getStats.bind(conversationController));
router.get('/unread-count', conversationController.getUnreadCount.bind(conversationController));
router.get('/:id', conversationController.getConversationById.bind(conversationController));
router.put('/:id', conversationController.updateConversation.bind(conversationController));
router.post('/:id/assign', conversationController.assignConversation.bind(conversationController));

export default router;







