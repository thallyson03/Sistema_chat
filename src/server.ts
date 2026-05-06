import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Importar rotas
import authRoutes from './routes/authRoutes';
import channelRoutes from './routes/channelRoutes';
import conversationRoutes from './routes/conversationRoutes';
import messageRoutes from './routes/messageRoutes';
import webhookRoutes, { setSocketIO } from './routes/webhookRoutes';
import mediaRoutes from './routes/mediaRoutes';
import n8nWebhookRoutes from './routes/n8nWebhookRoutes';
import botRoutes from './routes/botRoutes';
import quickReplyRoutes from './routes/quickReplyRoutes';
import sectorRoutes from './routes/sectorRoutes';
import userRoutes from './routes/userRoutes';
import ticketPortalRoutes from './routes/ticketPortalRoutes';
import externalDashboardRoutes from './routes/externalDashboardRoutes';
import pipelineRoutes from './routes/pipelineRoutes';
import publicPipelineRoutes from './routes/publicPipelineRoutes';
import contactRoutes from './routes/contactRoutes';
import contactImportRoutes from './routes/contactImportRoutes';
import campaignRoutes from './routes/campaignRoutes';
import journeyRoutes from './routes/journeyRoutes';
import whatsappTemplateRoutes from './routes/whatsappTemplateRoutes';
import contactListRoutes from './routes/contactListRoutes';
import opsRoutes from './routes/opsRoutes';
import { setSocketIO as setMessageSocketIO } from './controllers/messageController';
import { setMessageServiceSocketIO } from './services/messageService';
import { logger } from './utils/logger';
import { distributedLockService } from './services/distributedLockService';
import { internalApiLimiter, internalHeavyReadLimiter } from './middleware/internalRateLimit';

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar WhatsApp Official (se configurado)
import whatsappOfficial from './config/whatsappOfficial';
import { BotService } from './services/botService';
import { WebhookService } from './services/webhookService';
import { pipelineAutomationService } from './services/pipelineAutomationService';
import { runMediaPersistJobTick } from './services/mediaPersistJob';
import { runMediaConversionWorkerTick } from './services/mediaConversionWorker';
import { runMediaRetentionJobTick } from './services/mediaRetentionJob';
import { ConversationDistributionService } from './services/conversationDistributionService';
import { webhookIngestQueue } from './queues/webhookIngest.queue';
import {
  processWhatsAppOfficialWebhookPayload,
  processEvolutionWebhookPayload,
} from './routes/webhookRoutes';
import { phase1Flags } from './config/phase1Flags';
whatsappOfficial.init();

const app = express();
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv === 'true') {
  app.set('trust proxy', true);
} else if (trustProxyEnv && !Number.isNaN(Number(trustProxyEnv))) {
  app.set('trust proxy', Number(trustProxyEnv));
} else {
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const tokenFromAuth =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
    const authHeader = socket.handshake.headers?.authorization;
    const tokenFromHeader =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;
    const token = tokenFromAuth || tokenFromHeader;

    if (!token) {
      return next(new Error('Socket não autenticado: token ausente'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(new Error('Socket indisponível: JWT_SECRET não configurado'));
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    (socket as any).data.userId = decoded?.id || null;
    return next();
  } catch (error) {
    return next(new Error('Socket não autenticado: token inválido'));
  }
});

// Middlewares
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = req.headers['x-request-id']
    ? String(req.headers['x-request-id'])
    : crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http request completed', {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
// Middleware para log de requisições de webhook
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.includes('/webhooks') || req.path.includes('/whatsapp')) {
    console.log('📥 [Server] Requisição recebida:', {
      method: req.method,
      path: req.path,
      url: req.url,
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

// Preservar rawBody para validação de assinatura em webhooks (ex: WhatsApp Official)
app.use(express.json({
  verify: (req: any, res, buf) => {
    // Armazena o corpo bruto para uso posterior em validações HMAC
    (req as any).rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos de upload (público para Evolution API poder baixar)
import path from 'path';
import fs from 'fs';
app.use('/api/media/file', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    // Permitir CORS para Evolution API baixar arquivos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache de 1 ano
  }
}));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Socket.IO - Configuração básica
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  const userId = (socket as any).data?.userId;
  if (userId) {
    socket.join(`user_${userId}`);
  }

  socket.on('subscribe_conversation', (conversationId: string) => {
    if (!conversationId) return;
    socket.join(`conversation_${conversationId}`);
  });

  socket.on('unsubscribe_conversation', (conversationId: string) => {
    if (!conversationId) return;
    socket.leave(`conversation_${conversationId}`);
  });

  socket.on('subscribe_channel', (channelId: string) => {
    if (!channelId) return;
    socket.join(`channel_${channelId}`);
  });

  socket.on('unsubscribe_channel', (channelId: string) => {
    if (!channelId) return;
    socket.leave(`channel_${channelId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Configurar io nos módulos que precisam
setSocketIO(io);
setMessageSocketIO(io);
setMessageServiceSocketIO(io);
webhookIngestQueue.registerHandlers({
  processWhatsAppOfficial: processWhatsAppOfficialWebhookPayload,
  processEvolution: processEvolutionWebhookPayload,
});
logger.info('phase1 queue mode', {
  useBullMQ: phase1Flags.useBullMQ,
  webhookQueueEnabled: phase1Flags.webhookQueueEnabled,
  messageQueueEnabled: phase1Flags.messageQueueEnabled,
  botQueueEnabled: phase1Flags.botQueueEnabled,
  journeyQueueEnabled: phase1Flags.journeyQueueEnabled,
  pipelineAutomationQueueEnabled: phase1Flags.pipelineAutomationQueueEnabled,
  realtimeScopedEventsEnabled: phase1Flags.realtimeScopedEventsEnabled,
  providerQueueFallbackEnabled: phase1Flags.providerQueueFallbackEnabled,
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/channels', internalApiLimiter, channelRoutes);
app.use('/api/conversations', internalApiLimiter, internalHeavyReadLimiter, conversationRoutes);
app.use('/api/messages', internalApiLimiter, internalHeavyReadLimiter, messageRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/quick-replies', internalApiLimiter, quickReplyRoutes);
app.use('/api/sectors', internalApiLimiter, sectorRoutes);
app.use('/api/users', internalApiLimiter, userRoutes);
app.use('/api/ticket-portal', internalApiLimiter, internalHeavyReadLimiter, ticketPortalRoutes);
app.use('/api/external-dashboard', internalApiLimiter, internalHeavyReadLimiter, externalDashboardRoutes);
app.use('/api/pipelines', internalApiLimiter, internalHeavyReadLimiter, pipelineRoutes);
app.use('/api/public/pipelines', publicPipelineRoutes); // API pública para pipelines
app.use('/api/contacts', internalApiLimiter, contactImportRoutes); // Rotas de importação de contatos (deve vir antes)
app.use('/api/contacts', internalApiLimiter, internalHeavyReadLimiter, contactRoutes); // Rotas de contatos
app.use('/api/contact-lists', internalApiLimiter, internalHeavyReadLimiter, contactListRoutes); // Rotas de listas de contatos
app.use('/api/campaigns', internalApiLimiter, internalHeavyReadLimiter, campaignRoutes); // Rotas de campanhas
app.use('/api/journeys', internalApiLimiter, internalHeavyReadLimiter, journeyRoutes); // Rotas de jornadas / automações
app.use('/api/whatsapp/templates', internalApiLimiter, internalHeavyReadLimiter, whatsappTemplateRoutes); // Gestão de templates WhatsApp Official
app.use('/api/ops', internalApiLimiter, internalHeavyReadLimiter, opsRoutes);
app.use('/api/webhooks', webhookRoutes);
// Rota alternativa para compatibilidade com webhooks antigos
app.use('/webhooks', webhookRoutes);
app.use('/api/whatsapp', webhookRoutes);
// Rotas para n8n e bots
app.use('/api/webhooks/n8n', internalApiLimiter, internalHeavyReadLimiter, n8nWebhookRoutes);
app.use('/api/bots', internalApiLimiter, internalHeavyReadLimiter, botRoutes);

// SPA (Vite build) — Coolify / produção com um único domínio
const clientDistPath = path.join(__dirname, '../client/dist');
const clientIndexHtml = path.join(clientDistPath, 'index.html');
const serveStatic =
  (process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production') &&
  fs.existsSync(clientIndexHtml);

if (serveStatic) {
  app.use(express.static(clientDistPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/webhooks') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    res.sendFile(path.resolve(clientIndexHtml));
  });
}

// Middleware de tratamento de erros global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.errorWithCause('unhandled server error', err, {
    requestId: (req as any).requestId,
    requestUrl: req.url,
    requestMethod: req.method,
    ...(process.env.NODE_ENV !== 'production' ? { requestBody: req.body } : {}),
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Middleware para rotas não encontradas
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Exportar io para uso em outros módulos
export { io };

// Iniciar servidor
const PORT = process.env.PORT || 3007;

httpServer.listen(PORT, () => {
  logger.info('server started', {
    port: PORT,
    webhooks: [
      `http://localhost:${PORT}/api/webhooks/whatsapp`,
      `http://localhost:${PORT}/webhooks/whatsapp`,
      `http://localhost:${PORT}/api/whatsapp/whatsapp`,
    ],
  });
  
  const ngrokUrl = process.env.API_BASE_URL || process.env.NGROK_URL;
  if (ngrokUrl) {
    logger.info('public base url configured', {
      publicUrl: ngrokUrl,
      webhookUrl: `${ngrokUrl}/api/webhooks/whatsapp`,
    });
  }
  
  if (process.env.EVOLUTION_API_URL) {
    logger.info('evolution api configured', {
      evolutionApiUrl: process.env.EVOLUTION_API_URL,
    });
  }

  // Agendador simples para encerramento automático de conversas inativas
  const botService = new BotService();
  const webhookService = new WebhookService();
  const distributionService = new ConversationDistributionService();
  const intervalMs = 60 * 1000; // a cada 60 segundos
  logger.info('auto-close scheduler configured', {
    intervalSeconds: intervalMs / 1000,
  });

  setInterval(() => {
    void distributedLockService.runWithPgAdvisoryLock(
      91001,
      'auto-close-and-pipeline-tasks',
      async () => {
        await botService.autoCloseInactiveConversations();
        await webhookService.autoCloseInactiveConversationsForIntegrations();
        await pipelineAutomationService.processDueTasks();
      },
    );
  }, intervalMs);

  // Job em background: baixa mídia recebida (URLs da Meta/Evolution expiram) e grava em uploads/
  const mediaJobMs = Math.max(
    30_000,
    Number(process.env.MEDIA_PERSIST_JOB_INTERVAL_MS) || 120_000,
  );
  logger.info('media persist scheduler configured', {
    intervalSeconds: mediaJobMs / 1000,
    enabled: process.env.MEDIA_PERSIST_JOB_ENABLED !== 'false',
  });
  setInterval(() => {
    void distributedLockService.runWithPgAdvisoryLock(
      91002,
      'media-persist-job',
      async () => {
        await runMediaPersistJobTick();
      },
    );
  }, mediaJobMs);

  // Primeira execução após subir o servidor (não bloquear o listen)
  setTimeout(() => {
    void distributedLockService.runWithPgAdvisoryLock(
      91002,
      'media-persist-job-first-run',
      async () => {
        await runMediaPersistJobTick();
      },
    );
  }, 15_000);

  // Worker assíncrono de conversão de mídia (ex.: OGG -> MP3) para reduzir custo em requisições interativas.
  if (process.env.MEDIA_CONVERSION_WORKER_ENABLED !== 'false') {
    const mediaConversionJobMs = Math.max(
      30_000,
      Number(process.env.MEDIA_CONVERSION_WORKER_INTERVAL_MS) || 90_000,
    );
    logger.info('media conversion worker configured', {
      intervalSeconds: mediaConversionJobMs / 1000,
      enabled: true,
    });

    setInterval(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91004,
        'media-conversion-worker',
        async () => {
          await runMediaConversionWorkerTick();
        },
      );
    }, mediaConversionJobMs);

    setTimeout(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91004,
        'media-conversion-worker-first-run',
        async () => {
          await runMediaConversionWorkerTick();
        },
      );
    }, 20_000);
  }

  // Job em background: conversa em WAITING deve ser atribuída quando surgir agente disponível
  if (process.env.WAITING_QUEUE_JOB_ENABLED !== 'false') {
    const waitingQueueJobMs = Math.max(
      15_000,
      Number(process.env.WAITING_QUEUE_JOB_INTERVAL_MS) || 30_000,
    );
    logger.info('waiting queue scheduler configured', {
      intervalSeconds: waitingQueueJobMs / 1000,
      enabled: true,
    });

    setInterval(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91003,
        'waiting-queue-job',
        async () => {
          await distributionService.redistributeWaitingConversations();
        },
      );
    }, waitingQueueJobMs);

    setTimeout(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91003,
        'waiting-queue-job-first-run',
        async () => {
          await distributionService.redistributeWaitingConversations();
        },
      );
    }, 10_000);
  }

  // Job em background: retenção de mídia (storage-first), com dry-run opcional.
  if (process.env.MEDIA_RETENTION_ENABLED === 'true') {
    const mediaRetentionJobMs = Math.max(
      60_000,
      Number(process.env.MEDIA_RETENTION_INTERVAL_MS) || 60 * 60 * 1000,
    );
    logger.info('media retention scheduler configured', {
      intervalSeconds: mediaRetentionJobMs / 1000,
      dryRun: String(process.env.MEDIA_RETENTION_DRY_RUN || 'true').trim().toLowerCase() !== 'false',
      retentionDays: Math.max(1, Number(process.env.MEDIA_RETENTION_DAYS) || 120),
    });

    setInterval(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91005,
        'media-retention-job',
        async () => {
          await runMediaRetentionJobTick();
        },
      );
    }, mediaRetentionJobMs);

    setTimeout(() => {
      void distributedLockService.runWithPgAdvisoryLock(
        91005,
        'media-retention-job-first-run',
        async () => {
          await runMediaRetentionJobTick();
        },
      );
    }, 25_000);
  }
});
