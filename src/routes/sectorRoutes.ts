import { Router } from 'express';
import { SectorController } from '../controllers/sectorController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const sectorController = new SectorController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post('/', sectorController.create.bind(sectorController));
router.get('/', sectorController.list.bind(sectorController));
router.get('/:id', sectorController.getById.bind(sectorController));
router.put('/:id', sectorController.update.bind(sectorController));
router.delete('/:id', sectorController.delete.bind(sectorController));

export default router;

