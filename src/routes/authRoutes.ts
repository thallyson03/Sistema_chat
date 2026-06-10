import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { loginSchema, registerSchema } from '../schemas/authSchemas';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const authController = new AuthController();

const authGeneralLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_PER_MIN || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições de autenticação. Tente novamente em instantes.',
  },
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas. Tente novamente em alguns minutos.',
  },
});

router.use(authGeneralLimiter);

router.post(
  '/register',
  authenticateToken,
  authorizeRoles('ADMIN'),
  authLimiter,
  validateBody(registerSchema),
  authController.register.bind(authController),
);

router.post('/login', authLimiter, validateBody(loginSchema), authController.login.bind(authController));
router.post('/refresh', authLimiter, authController.refresh.bind(authController));
router.post('/clear-session', authController.clearSession.bind(authController));
router.post('/logout', authenticateToken, authController.logout.bind(authController));
router.post('/heartbeat', authenticateToken, authController.heartbeat.bind(authController));
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

export default router;
