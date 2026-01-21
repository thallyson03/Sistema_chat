import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const webhookController = new WebhookController();

// Rotas protegidas (precisam autenticação)
router.post('/register', authenticateToken, webhookController.registerWebhook.bind(webhookController));
router.get('/', authenticateToken, webhookController.listWebhooks.bind(webhookController));
router.put('/:id', authenticateToken, webhookController.updateWebhook.bind(webhookController));
router.delete('/:id', authenticateToken, webhookController.deleteWebhook.bind(webhookController));
router.get('/:id/executions', authenticateToken, webhookController.getWebhookExecutions.bind(webhookController));

// Rota pública para receber webhooks do n8n (com autenticação via secret)
router.post('/receive', webhookController.receiveWebhook.bind(webhookController));

export default router;



