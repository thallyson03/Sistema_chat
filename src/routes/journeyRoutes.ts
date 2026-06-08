import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const adminOrSupervisor = authorizeRoles('ADMIN', 'SUPERVISOR');
import { JourneyController } from '../controllers/journeyController';

const router = Router();
const journeyController = new JourneyController();

// Todas as rotas de jornadas exigem autenticação
router.use(authenticateToken);

router.post('/', adminOrSupervisor, journeyController.createJourney.bind(journeyController));
router.get('/', journeyController.getJourneys.bind(journeyController));
router.get('/:id', journeyController.getJourneyById.bind(journeyController));
router.put('/:id', adminOrSupervisor, journeyController.updateJourney.bind(journeyController));
router.delete('/:id', adminOrSupervisor, journeyController.deleteJourney.bind(journeyController));
router.put('/:id/graph', adminOrSupervisor, journeyController.updateJourneyGraph.bind(journeyController));
router.post('/:id/execute', adminOrSupervisor, journeyController.executeJourney.bind(journeyController));

// Buscar estatísticas de uma jornada
router.get('/:id/stats', journeyController.getJourneyStats.bind(journeyController));

export default router;


