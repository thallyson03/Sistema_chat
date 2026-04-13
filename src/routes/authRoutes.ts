import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();
const authController = new AuthController();

// Rate limiting para evitar brute force no login e registro
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // limite de tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas. Tente novamente em alguns minutos.',
  },
});

// Registro de usuários deve ser restrito a administradores autenticados
router.post(
  '/register',
  authenticateToken,
  authorizeRoles('ADMIN'),
  authLimiter,
  authController.register.bind(authController)
);

// Login público, mas com rate limiting
router.post('/login', authLimiter, authController.login.bind(authController));
router.post('/logout', authenticateToken, authController.logout.bind(authController));
router.post('/heartbeat', authenticateToken, authController.heartbeat.bind(authController));
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

export default router;







