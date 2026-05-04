import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { queueMetricsService } from '../services/queueMetricsService';
import { webhookIngestQueue } from '../queues/webhookIngest.queue';
import { messageSendQueue } from '../queues/messageSend.queue';
import { botProcessQueue } from '../queues/botProcess.queue';
import { journeyProcessQueue } from '../queues/journeyProcess.queue';
import { pipelineAutomationQueue } from '../queues/pipelineAutomation.queue';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'SUPERVISOR'));

router.get('/queues/metrics', async (_req, res) => {
  const [webhook, message, bot, journey, pipeline] = await Promise.all([
    webhookIngestQueue.getStats(),
    messageSendQueue.getStats(),
    botProcessQueue.getStats(),
    journeyProcessQueue.getStats(),
    pipelineAutomationQueue.getStats(),
  ]);

  res.json({
    timestamp: new Date().toISOString(),
    counters: queueMetricsService.snapshot(),
    queues: {
      webhookIngest: webhook,
      messageSend: message,
      botProcess: bot,
      journeyProcess: journey,
      pipelineAutomation: pipeline,
    },
  });
});

export default router;

