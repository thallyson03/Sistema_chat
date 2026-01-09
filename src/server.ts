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

// Carregar variáveis de ambiente
dotenv.config();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Configurar io no webhookRoutes antes de usar as rotas
setSocketIO(io);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/media', mediaRoutes);
app.use('/webhooks', webhookRoutes);
// Rota alternativa para compatibilidade com webhooks antigos
app.use('/api/whatsapp', webhookRoutes);

// Exportar io para uso em outros módulos
export { io };

// Iniciar servidor
const PORT = process.env.PORT || 3007;

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Webhooks disponíveis em http://localhost:${PORT}/webhooks`);
  
  if (process.env.EVOLUTION_API_URL) {
    console.log(`🔗 Evolution API: ${process.env.EVOLUTION_API_URL}`);
  }
});
