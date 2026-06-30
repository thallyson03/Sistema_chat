import { Router } from 'express';
import { PipelineController } from '../controllers/pipelineController';
import { DealController } from '../controllers/dealController';
import { PipelineCustomFieldController } from '../controllers/pipelineCustomFieldController';
import { PipelineAutomationController } from '../controllers/pipelineAutomationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();
const pipelineController = new PipelineController();
const dealController = new DealController();
const customFieldController = new PipelineCustomFieldController();
const automationController = new PipelineAutomationController();

const adminOrSupervisor = authorizeRoles('ADMIN', 'SUPERVISOR');

router.use(authenticateToken);

// ============================================
// DASHBOARD METRICS (antes de rotas /:id)
// ============================================
router.get('/dashboard-metrics', dealController.getPipelineDashboardMetrics.bind(dealController));

// ============================================
// DEALS
// ============================================
router.post('/deals', dealController.createDeal.bind(dealController));
router.get('/deals', dealController.getDeals.bind(dealController));
router.get('/deals/:id/statistics', dealController.getDealStatistics.bind(dealController));
router.get('/deals/:id', dealController.getDealById.bind(dealController));
router.get('/tasks/calendar', dealController.getCalendarTasks.bind(dealController));
router.put('/deals/:id', dealController.updateDeal.bind(dealController));
router.put('/deals/:id/move', dealController.moveDealToStage.bind(dealController));
router.post('/deals/:id/tags', dealController.addTagToDeal.bind(dealController));
router.delete('/deals/:id/tags/:tagId', dealController.removeTagFromDeal.bind(dealController));
router.delete('/deals/:id', adminOrSupervisor, dealController.deleteDeal.bind(dealController));

// ============================================
// PIPELINES
// ============================================
router.post('/', adminOrSupervisor, pipelineController.createPipeline.bind(pipelineController));
router.get('/', pipelineController.getPipelines.bind(pipelineController));
router.get('/:id', pipelineController.getPipelineById.bind(pipelineController));
router.put('/:id', adminOrSupervisor, pipelineController.updatePipeline.bind(pipelineController));
router.delete('/:id', authorizeRoles('ADMIN'), pipelineController.deletePipeline.bind(pipelineController));

// ============================================
// STAGES
// ============================================
router.post('/:pipelineId/stages', adminOrSupervisor, pipelineController.createStage.bind(pipelineController));
router.put('/stages/:id', adminOrSupervisor, pipelineController.updateStage.bind(pipelineController));
router.delete('/stages/:id', adminOrSupervisor, pipelineController.deleteStage.bind(pipelineController));
router.put('/:pipelineId/stages/reorder', adminOrSupervisor, pipelineController.reorderStages.bind(pipelineController));

// ============================================
// DEAL ACTIVITIES
// ============================================
router.post('/deals/:dealId/activities', dealController.createActivity.bind(dealController));
router.get('/deals/:dealId/activities', dealController.getDealActivities.bind(dealController));
router.put('/tasks/:taskId', dealController.updatePipelineTask.bind(dealController));
router.put(
  '/deals/:dealId/tasks/by-title',
  dealController.updatePipelineTaskByDealAndTitle.bind(dealController),
);

// ============================================
// CUSTOM FIELDS
// ============================================
router.post('/:pipelineId/custom-fields', adminOrSupervisor, customFieldController.createCustomField.bind(customFieldController));
router.get('/:pipelineId/custom-fields', customFieldController.getCustomFields.bind(customFieldController));
router.put('/custom-fields/:id', adminOrSupervisor, customFieldController.updateCustomField.bind(customFieldController));
router.delete('/custom-fields/:id', adminOrSupervisor, customFieldController.deleteCustomField.bind(customFieldController));
router.put('/:pipelineId/custom-fields/reorder', adminOrSupervisor, customFieldController.reorderCustomFields.bind(customFieldController));

// ============================================
// STATISTICS
// ============================================
router.get('/:pipelineId/stats', dealController.getPipelineStats.bind(dealController));

// ============================================
// AUTOMATIONS
// ============================================
router.get('/:id/automations', automationController.getAutomations.bind(automationController));
router.put('/:id/automations', adminOrSupervisor, automationController.saveAutomations.bind(automationController));

export default router;
