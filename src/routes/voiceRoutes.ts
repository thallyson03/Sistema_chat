import { Router } from 'express';
import { VoiceController } from '../controllers/voiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const controller = new VoiceController();

/** Montar em /api/webhooks e /webhooks */
const voiceWebhookRoutes = Router();
voiceWebhookRoutes.post('/voice/twilio/voice', controller.twilioVoiceWebhook.bind(controller));
voiceWebhookRoutes.post(
  '/voice/twilio/outbound-twiml',
  controller.twilioOutboundTwiml.bind(controller),
);
voiceWebhookRoutes.post('/voice/twilio/status', controller.twilioStatusWebhook.bind(controller));

/** Montar em /api/voice */
const voiceApiRoutes = Router();
voiceApiRoutes.use(authenticateToken);

voiceApiRoutes.get('/channels', controller.listChannels.bind(controller));
voiceApiRoutes.post(
  '/channels',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  controller.createAccountChannel.bind(controller),
);
voiceApiRoutes.put(
  '/channels/:channelId',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  controller.updateAccountChannel.bind(controller),
);
voiceApiRoutes.get(
  '/channels/:channelId/numbers/search',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  controller.searchNumbers.bind(controller),
);
voiceApiRoutes.post(
  '/channels/:channelId/numbers/purchase',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  controller.purchaseNumber.bind(controller),
);
voiceApiRoutes.post(
  '/channels/:channelId/numbers/release',
  authorizeRoles('ADMIN'),
  controller.releaseNumber.bind(controller),
);
voiceApiRoutes.post('/channels/:channelId/token', controller.createToken.bind(controller));
voiceApiRoutes.post('/calls', controller.startCall.bind(controller));
voiceApiRoutes.get('/calls', controller.listCalls.bind(controller));

export { voiceApiRoutes };
export default voiceWebhookRoutes;
