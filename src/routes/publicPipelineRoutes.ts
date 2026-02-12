import { Router } from 'express';
import { PipelineController } from '../controllers/pipelineController';
import { DealController } from '../controllers/dealController';

const router = Router();
const pipelineController = new PipelineController();
const dealController = new DealController();

// Rotas públicas para API externa
// ============================================
// GET Pipeline por ID (público)
router.get('/:pipelineId', pipelineController.getPipelineById.bind(pipelineController));

// POST Criar Deal via API (público)
router.post('/:pipelineId/deals', dealController.createDealPublic.bind(dealController));

export default router;



