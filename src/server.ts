import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

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
import pipelineRoutes from './routes/pipelineRoutes';
import publicPipelineRoutes from './routes/publicPipelineRoutes';
import contactRoutes from './routes/contactRoutes';
import contactImportRoutes from './routes/contactImportRoutes';
import campaignRoutes from './routes/campaignRoutes';
import journeyRoutes from './routes/journeyRoutes';
import whatsappTemplateRoutes from './routes/whatsappTemplateRoutes';
import contactListRoutes from './routes/contactListRoutes';
import { setSocketIO as setMessageSocketIO } from './controllers/messageController';

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar WhatsApp Official (se configurado)
import whatsappOfficial from './config/whatsappOfficial';
import { BotService } from './services/botService';
import { WebhookService } from './services/webhookService';
import { pipelineAutomationService } from './services/pipelineAutomationService';
import { runMediaPersistJobTick } from './services/mediaPersistJob';
import { ConversationDistributionService } from './services/conversationDistributionService';
whatsappOfficial.init();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middlewares
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

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Configurar io nos módulos que precisam
setSocketIO(io);
setMessageSocketIO(io);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/public/pipelines', publicPipelineRoutes); // API pública para pipelines
app.use('/api/contacts', contactImportRoutes); // Rotas de importação de contatos (deve vir antes)
app.use('/api/contacts', contactRoutes); // Rotas de contatos
app.use('/api/contact-lists', contactListRoutes); // Rotas de listas de contatos
app.use('/api/campaigns', campaignRoutes); // Rotas de campanhas
app.use('/api/journeys', journeyRoutes); // Rotas de jornadas / automações
app.use('/api/whatsapp/templates', whatsappTemplateRoutes); // Gestão de templates WhatsApp Official
app.use('/api/webhooks', webhookRoutes);
// Rota alternativa para compatibilidade com webhooks antigos
app.use('/webhooks', webhookRoutes);
app.use('/api/whatsapp', webhookRoutes);
// Rotas para n8n e bots
app.use('/api/webhooks/n8n', n8nWebhookRoutes);
app.use('/api/bots', botRoutes);

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
  console.error('[Server] Erro não tratado:', err);
  console.error('[Server] Stack trace:', err.stack);
  console.error('[Server] Request URL:', req.url);
  console.error('[Server] Request Method:', req.method);
  console.error('[Server] Request Body:', req.body);
  
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
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Webhooks disponíveis em:`);
  console.log(`   - http://localhost:${PORT}/api/webhooks/whatsapp`);
  console.log(`   - http://localhost:${PORT}/webhooks/whatsapp`);
  console.log(`   - http://localhost:${PORT}/api/whatsapp/whatsapp`);
  
  const ngrokUrl = process.env.API_BASE_URL || process.env.NGROK_URL;
  if (ngrokUrl) {
    console.log(`🌐 URL pública (ngrok): ${ngrokUrl}`);
    console.log(`📨 Webhook URL completa: ${ngrokUrl}/api/webhooks/whatsapp`);
  }
  
  if (process.env.EVOLUTION_API_URL) {
    console.log(`🔗 Evolution API: ${process.env.EVOLUTION_API_URL}`);
  }

  // Agendador simples para encerramento automático de conversas inativas
  const botService = new BotService();
  const webhookService = new WebhookService();
  const distributionService = new ConversationDistributionService();
  const intervalMs = 60 * 1000; // a cada 60 segundos
  console.log(`⏱️ Auto-close de conversas inativas agendado a cada ${intervalMs / 1000}s`);

  setInterval(() => {
    botService.autoCloseInactiveConversations().catch((err) => {
      console.error('[AutoClose] Erro ao executar verificação de conversas inativas (bots):', err);
    });
    webhookService.autoCloseInactiveConversationsForIntegrations().catch((err) => {
      console.error(
        '[AutoClose] Erro ao executar verificação de conversas inativas (integrações):',
        err,
      );
    });

    // Processar tarefas vencidas do pipeline e notificar no chat
    pipelineAutomationService.processDueTasks().catch((err) => {
      console.error('[PipelineTasks] Erro ao processar tarefas vencidas:', err);
    });
  }, intervalMs);

  // Job em background: baixa mídia recebida (URLs da Meta/Evolution expiram) e grava em uploads/
  const mediaJobMs = Math.max(
    30_000,
    Number(process.env.MEDIA_PERSIST_JOB_INTERVAL_MS) || 120_000,
  );
  console.log(
    `[MediaPersistJob] Agendado a cada ${mediaJobMs / 1000}s (desative com MEDIA_PERSIST_JOB_ENABLED=false)`,
  );
  setInterval(() => {
    runMediaPersistJobTick().catch((err) => {
      console.error('[MediaPersistJob] Erro no tick:', err);
    });
  }, mediaJobMs);

  // Primeira execução após subir o servidor (não bloquear o listen)
  setTimeout(() => {
    runMediaPersistJobTick().catch((err) => {
      console.error('[MediaPersistJob] Erro na primeira execução:', err);
    });
  }, 15_000);

  // Job em background: conversa em WAITING deve ser atribuída quando surgir agente disponível
  if (process.env.WAITING_QUEUE_JOB_ENABLED !== 'false') {
    const waitingQueueJobMs = Math.max(
      15_000,
      Number(process.env.WAITING_QUEUE_JOB_INTERVAL_MS) || 30_000,
    );
    console.log(
      `[WaitingQueueJob] Agendado a cada ${waitingQueueJobMs / 1000}s (desative com WAITING_QUEUE_JOB_ENABLED=false)`,
    );

    setInterval(() => {
      distributionService.redistributeWaitingConversations().catch((err) => {
        console.error('[WaitingQueueJob] Erro no tick:', err);
      });
    }, waitingQueueJobMs);

    setTimeout(() => {
      distributionService.redistributeWaitingConversations().catch((err) => {
        console.error('[WaitingQueueJob] Erro na primeira execução:', err);
      });
    }, 10_000);
  }
});
