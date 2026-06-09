import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { createUserSchema, updateUserSchema } from '../schemas/userSchemas';

const router = Router();
const userController = new UserController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post('/', validateBody(createUserSchema), userController.createUser.bind(userController));
router.get('/', userController.listUsers.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));
router.put('/:id', validateBody(updateUserSchema), userController.updateUser.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));
router.get('/:id/sectors', userController.getUserSectors.bind(userController));
router.post('/:id/sectors', userController.assignUserToSector.bind(userController));
router.delete('/:id/sectors', userController.removeUserFromSector.bind(userController));
router.post('/:id/pause', userController.setPause.bind(userController));
router.get('/:id/pause', userController.getPauseStatus.bind(userController));

export default router;

