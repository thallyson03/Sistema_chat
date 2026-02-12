import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { JourneyController } from '../controllers/journeyController';

const router = Router();
const journeyController = new JourneyController();

// Todas as rotas de jornadas exigem autenticação
router.use(authenticateToken);

router.post('/', journeyController.createJourney.bind(journeyController));
router.get('/', journeyController.getJourneys.bind(journeyController));
router.get('/:id', journeyController.getJourneyById.bind(journeyController));
router.put('/:id', journeyController.updateJourney.bind(journeyController));
router.delete('/:id', journeyController.deleteJourney.bind(journeyController));

// Atualizar grafo (nós + conexões) de uma jornada
router.put('/:id/graph', journeyController.updateJourneyGraph.bind(journeyController));

// Executar jornada para um contato (teste)
router.post('/:id/execute', journeyController.executeJourney.bind(journeyController));

// Buscar estatísticas de uma jornada
router.get('/:id/stats', journeyController.getJourneyStats.bind(journeyController));

export default router;


