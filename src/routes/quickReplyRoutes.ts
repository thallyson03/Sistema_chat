import { Router } from 'express';
import { QuickReplyController } from '../controllers/quickReplyController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const quickReplyController = new QuickReplyController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post('/', quickReplyController.create.bind(quickReplyController));
router.get('/', quickReplyController.list.bind(quickReplyController));
router.get('/categories', quickReplyController.getCategories.bind(quickReplyController));
router.get('/:id', quickReplyController.getById.bind(quickReplyController));
router.get('/:id/preview', quickReplyController.preview.bind(quickReplyController));
router.put('/:id', quickReplyController.update.bind(quickReplyController));
router.delete('/:id', quickReplyController.delete.bind(quickReplyController));

export default router;

