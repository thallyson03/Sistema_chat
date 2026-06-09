import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { WebhookController } from '../controllers/webhookController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { registerWebhookSchema, updateWebhookSchema } from '../schemas/webhookSchemas';

const router = Router();
const webhookController = new WebhookController();

const n8nReceiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.N8N_WEBHOOK_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições ao webhook n8n. Tente novamente em alguns minutos.',
  },
});

// Rotas protegidas (precisam autenticação de administrador)
router.post(
  '/register',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateBody(registerWebhookSchema),
  webhookController.registerWebhook.bind(webhookController),
);
router.get(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  webhookController.listWebhooks.bind(webhookController),
);
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateBody(updateWebhookSchema),
  webhookController.updateWebhook.bind(webhookController),
);
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  webhookController.deleteWebhook.bind(webhookController),
);
router.get(
  '/:id/executions',
  authenticateToken,
  authorizeRoles('ADMIN'),
  webhookController.getWebhookExecutions.bind(webhookController),
);

// Rota pública para receber webhooks do n8n (autenticação via header ou body)
router.post(
  '/receive',
  n8nReceiveLimiter,
  webhookController.receiveWebhook.bind(webhookController),
);

export default router;
