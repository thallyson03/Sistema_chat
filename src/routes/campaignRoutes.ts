import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { createCampaignSchema } from '../schemas/campaignSchemas';

const adminOrSupervisor = authorizeRoles('ADMIN', 'SUPERVISOR');
import { CampaignController } from '../controllers/campaignController';

const router = Router();
const campaignController = new CampaignController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post(
  '/',
  adminOrSupervisor,
  validateBody(createCampaignSchema),
  campaignController.createCampaign.bind(campaignController),
);
router.get('/', adminOrSupervisor, campaignController.getCampaigns.bind(campaignController));
router.get('/:id', adminOrSupervisor, campaignController.getCampaignById.bind(campaignController));
router.put('/:id', adminOrSupervisor, campaignController.updateCampaign.bind(campaignController));
router.delete('/:id', adminOrSupervisor, campaignController.deleteCampaign.bind(campaignController));

router.post('/:id/recipients', adminOrSupervisor, campaignController.addRecipients.bind(campaignController));
router.post('/:id/execute', adminOrSupervisor, campaignController.executeCampaign.bind(campaignController));

export default router;


