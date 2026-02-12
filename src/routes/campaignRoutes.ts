import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { CampaignController } from '../controllers/campaignController';

const router = Router();
const campaignController = new CampaignController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

router.post('/', campaignController.createCampaign.bind(campaignController));
router.get('/', campaignController.getCampaigns.bind(campaignController));
router.get('/:id', campaignController.getCampaignById.bind(campaignController));
router.put('/:id', campaignController.updateCampaign.bind(campaignController));
router.delete('/:id', campaignController.deleteCampaign.bind(campaignController));

// Adicionar destinatários
router.post('/:id/recipients', campaignController.addRecipients.bind(campaignController));

// Executar campanha (envio)
router.post('/:id/execute', campaignController.executeCampaign.bind(campaignController));

export default router;


