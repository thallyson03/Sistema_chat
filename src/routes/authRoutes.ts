import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authenticateToken, authController.logout.bind(authController));
router.get('/me', authenticateToken, authController.getCurrentUser.bind(authController));

export default router;







