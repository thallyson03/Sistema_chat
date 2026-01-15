import { Router } from 'express';
import { BotController } from '../controllers/botController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const botController = new BotController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// CRUD de Bots
router.post('/', botController.createBot.bind(botController));
router.get('/', botController.listBots.bind(botController));
router.get('/:id', botController.getBot.bind(botController));
router.put('/:id', botController.updateBot.bind(botController));
router.delete('/:id', botController.deleteBot.bind(botController));

// Intents
router.post('/:botId/intents', botController.createIntent.bind(botController));
router.get('/:botId/intents', botController.listIntents.bind(botController));

// Responses
router.post('/responses', botController.createResponse.bind(botController));

// Flows
router.post('/:botId/flows', botController.createFlow.bind(botController));
router.get('/:botId/flows', botController.listFlows.bind(botController));

// Testar bot
router.post('/:id/test', botController.testBot.bind(botController));

// Fluxos
router.get('/flows/:flowId', botController.getFlow.bind(botController));
router.put('/flows/:flowId', botController.updateFlow.bind(botController));
router.delete('/flows/:flowId', botController.deleteFlow.bind(botController));

// Steps
router.post('/flows/:flowId/steps', botController.createFlowStep.bind(botController));
router.put('/steps/:stepId', botController.updateFlowStep.bind(botController));
router.delete('/steps/:stepId', botController.deleteFlowStep.bind(botController));

// Condições
router.post('/steps/:stepId/conditions', botController.createFlowCondition.bind(botController));

// Variáveis
router.post('/:botId/variables', botController.createVariable.bind(botController));
router.get('/:botId/variables', botController.listVariables.bind(botController));
router.put('/variables/:id', botController.updateVariable.bind(botController));
router.delete('/variables/:id', botController.deleteVariable.bind(botController));

export default router;

