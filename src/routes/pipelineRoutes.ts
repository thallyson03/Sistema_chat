import { Router } from 'express';
import { PipelineController } from '../controllers/pipelineController';
import { DealController } from '../controllers/dealController';
import { PipelineCustomFieldController } from '../controllers/pipelineCustomFieldController';
import { PipelineAutomationController } from '../controllers/pipelineAutomationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const pipelineController = new PipelineController();
const dealController = new DealController();
const customFieldController = new PipelineCustomFieldController();
const automationController = new PipelineAutomationController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// ============================================
// DEALS (deve vir ANTES de /:id para evitar conflito)
// ============================================
router.post('/deals', dealController.createDeal.bind(dealController));
router.get('/deals', dealController.getDeals.bind(dealController));
router.get('/deals/:id', dealController.getDealById.bind(dealController));
router.put('/deals/:id', dealController.updateDeal.bind(dealController));
router.put('/deals/:id/move', dealController.moveDealToStage.bind(dealController));
router.delete('/deals/:id', dealController.deleteDeal.bind(dealController));

// ============================================
// PIPELINES
// ============================================
router.post('/', pipelineController.createPipeline.bind(pipelineController));
router.get('/', pipelineController.getPipelines.bind(pipelineController));
router.get('/:id', pipelineController.getPipelineById.bind(pipelineController));
router.put('/:id', pipelineController.updatePipeline.bind(pipelineController));
router.delete('/:id', pipelineController.deletePipeline.bind(pipelineController));

// ============================================
// STAGES
// ============================================
router.post('/:pipelineId/stages', pipelineController.createStage.bind(pipelineController));
router.put('/stages/:id', pipelineController.updateStage.bind(pipelineController));
router.delete('/stages/:id', pipelineController.deleteStage.bind(pipelineController));
router.put('/:pipelineId/stages/reorder', pipelineController.reorderStages.bind(pipelineController));

// ============================================
// DEAL ACTIVITIES
// ============================================
router.post('/deals/:dealId/activities', dealController.createActivity.bind(dealController));
router.get('/deals/:dealId/activities', dealController.getDealActivities.bind(dealController));

// ============================================
// CUSTOM FIELDS
// ============================================
router.post('/:pipelineId/custom-fields', customFieldController.createCustomField.bind(customFieldController));
router.get('/:pipelineId/custom-fields', customFieldController.getCustomFields.bind(customFieldController));
router.put('/custom-fields/:id', customFieldController.updateCustomField.bind(customFieldController));
router.delete('/custom-fields/:id', customFieldController.deleteCustomField.bind(customFieldController));
router.put('/:pipelineId/custom-fields/reorder', customFieldController.reorderCustomFields.bind(customFieldController));

// ============================================
// STATISTICS
// ============================================
router.get('/:pipelineId/stats', dealController.getPipelineStats.bind(dealController));

// ============================================
// AUTOMATIONS
// ============================================
router.get('/:id/automations', automationController.getAutomations.bind(automationController));
router.put('/:id/automations', automationController.saveAutomations.bind(automationController));

export default router;

