import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { WebhookService } from '../services/webhookService';
import { BotService } from '../services/botService';
import { ConversationDistributionService } from '../services/conversationDistributionService';
import { ConversationService } from '../services/conversationService';
import { SatisfactionSurveyService } from '../services/satisfactionSurveyService';
import { dispatchJourneyEvent } from '../services/journeyEventDispatcher';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { phase1Flags } from '../config/phase1Flags';
import { webhookIngestQueue } from '../queues/webhookIngest.queue';
import { idempotencyService } from '../services/idempotencyService';
import { botProcessQueue } from '../queues/botProcess.queue';
import {
  emitChannelStatusUpdate,
  emitContactPresence,
  emitConversationDelta,
  emitMessageContentUpdate,
  emitMessageStatus,
  emitQrcodeUpdate,
} from '../utils/realtimeEvents';
import { hybridCacheService } from '../services/hybridCacheService';
import { extractWhatsAppWebhookStatusError } from '../utils/whatsappMessagingWindow';
import { extractEvolutionMediaFields } from '../utils/whatsappMedia';
import {
  extractEvolutionEventType,
  isEvolutionConnectionEvent,
  isEvolutionHistorySyncEvent,
  isEvolutionIncomingMessageEvent,
  extractIncomingMessageBundles,
  normalizeEvolutionMessageKey,
  normalizeEvolutionConnectionPayload,
  extractEvolutionInstanceName,
  extractEvolutionInstanceUuid,
  attachWebhookSourceToEventData,
  getWebhookSourceFromEventData,
  evolutionWebhookLogPrefix,
  CRM_WEBHOOK_SOURCE_KEY,
  type EvolutionWebhookSource,
  extractEvolutionQrBase64,
  extractPhoneFromEvolutionJid,
  parseEvolutionMessagePatches,
  parseEvolutionPresence,
  extractPhoneFromEvolutionPresenceData,
} from '../utils/evolutionWebhook';
import { normalizePhone } from '../utils/phone';
import { parseEvolutionMessageContent } from '../utils/evolutionMessageContent';
import { contactResolutionService } from '../services/contactResolutionService';
import { conversationResolutionService } from '../services/conversationResolutionService';
import {
  getBaileysApi,
  getBaileysWebhookPath,
  getWhatsAppChannelProvider,
  isBaileysWhatsAppChannel,
  resolveBaileysApiKey,
  resolveDefaultBaileysApiKey,
} from '../utils/channelWhatsAppProvider';

const webhookService = new WebhookService();
const botService = new BotService();
const conversationService = new ConversationService();
const satisfactionSurveyService = new SatisfactionSurveyService();

// io será injetado via função
let io: any = null;

function invalidateConversationMetricsCache(): void {
  void hybridCacheService.invalidateByPrefix('conversation:stats:');
  void hybridCacheService.invalidateByPrefix('conversation:unread-count:');
}

export function setSocketIO(socketIO: any) {
  io = socketIO;
}

export function getSocketIO() {
  return io;
}

const router = Router();
const isDevLogs = process.env.NODE_ENV !== 'production';

const webhookReceiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MIN || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições de webhook. Tente novamente em instantes.',
  },
});

async function resolveWebhookVerifyTokens(): Promise<string[]> {
  const tokens = new Set<string>();

  // Fallback global (.env) para manter compatibilidade
  if (process.env.WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN) {
    tokens.add(process.env.WHATSAPP_DEV_WEBHOOK_VERIFY_TOKEN);
  }
  if (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    tokens.add(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  }

  // Tokens por canal (configuráveis pela interface)
  try {
    const channels = await prisma.channel.findMany({
      where: {
        type: 'WHATSAPP',
      },
      select: {
        id: true,
        config: true,
      },
    });

    for (const channel of channels) {
      const cfg = (channel.config || {}) as any;
      const provider = String(cfg.provider || '').toLowerCase();

      // Foca apenas em canais Meta/Official
      if (provider !== 'whatsapp_official' && provider !== 'meta') continue;

      const tokenCandidates = [
        cfg.webhookVerifyToken,
        cfg.verifyToken,
        cfg.metaWebhookVerifyToken,
      ];

      for (const t of tokenCandidates) {
        if (typeof t === 'string' && t.trim()) {
          tokens.add(t.trim());
        }
      }
    }
  } catch (error: any) {
    console.warn(
      '[WebhookWhatsApp] ⚠️ Falha ao buscar verify token por canal, usando apenas .env:',
      error?.message,
    );
  }

  return Array.from(tokens);
}

async function resolveWebhookAppSecret(req: Request): Promise<string | null> {
  try {
    const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    const channels = await prisma.channel.findMany({
      where: { type: 'WHATSAPP' },
      select: { id: true, name: true, config: true },
    });

    const candidates: Array<{ channelId: string; channelName: string; cfg: any }> = [];

    for (const channel of channels) {
      const cfg = (channel.config || {}) as any;
      const appSecret =
        cfg.appSecret ||
        cfg.whatsappAppSecret ||
        cfg.metaAppSecret ||
        null;

      if (typeof appSecret === 'string' && appSecret.trim()) {
        candidates.push({
          channelId: channel.id,
          channelName: channel.name,
          cfg,
        });
      }
    }

    // 1) Prioriza canal com mesmo phone_number_id do payload
    for (const candidate of candidates) {
      const cfgPhone = String(candidate.cfg.phoneNumberId || '').trim();
      if (phoneNumberId && cfgPhone && cfgPhone === String(phoneNumberId).trim()) {
        const secret =
          candidate.cfg.appSecret ||
          candidate.cfg.whatsappAppSecret ||
          candidate.cfg.metaAppSecret;
        console.log('[WebhookWhatsApp] 🔐 App Secret resolvido por phone_number_id:', {
          channelId: candidate.channelId,
          channelName: candidate.channelName,
          phoneNumberId,
        });
        return String(secret).trim();
      }
    }

    // 2) Fallback: primeiro canal WhatsApp que tenha appSecret
    if (candidates.length > 0) {
      const candidate = candidates[0];
      const secret =
        candidate.cfg.appSecret ||
        candidate.cfg.whatsappAppSecret ||
        candidate.cfg.metaAppSecret;
      console.log('[WebhookWhatsApp] 🔐 App Secret resolvido por fallback de canal:', {
        channelId: candidate.channelId,
        channelName: candidate.channelName,
        hasPhoneInPayload: !!phoneNumberId,
      });
      if (typeof secret === 'string' && secret.trim()) {
        return secret.trim();
      }
    }
  } catch (error: any) {
    console.warn(
      '[WebhookWhatsApp] ⚠️ Falha ao buscar App Secret por canal, usando fallback global:',
      error?.message,
    );
  }

  const fallback = process.env.WHATSAPP_APP_SECRET;
  if (typeof fallback === 'string' && fallback.trim()) {
    console.log('[WebhookWhatsApp] 🔐 Usando App Secret global (.env) como fallback.');
    return fallback.trim();
  }
  return null;
}

function digitsOnlyPhone(value: string | undefined | null): string {
  return String(value || '').replace(/\D/g, '');
}

/** Tipos do Cloud API que não são “conversa do cliente” e não devem virar mensagem no CRM. */
const WHATSAPP_OFFICIAL_IGNORE_TYPES = new Set([
  'system',
  'reaction',
  'unsupported',
  'unknown',
  'ephemeral',
  'protocol_message',
]);

async function resolveWhatsAppOfficialChannel(value: any) {
  const payloadPhoneNumberId = String(value?.metadata?.phone_number_id || '').trim();

  const channels = await prisma.channel.findMany({
    where: { type: 'WHATSAPP' },
    select: { id: true, name: true, config: true, status: true },
    orderBy: { createdAt: 'desc' },
  });

  const officialChannels = channels.filter((channel) => {
    const cfg = (channel.config || {}) as any;
    const provider = String(cfg.provider || '').toLowerCase();
    return provider === 'whatsapp_official' || provider === 'meta';
  });

  if (officialChannels.length === 0) return null;

  if (payloadPhoneNumberId) {
    const matchByPhoneId = officialChannels.find((channel) => {
      const cfg = (channel.config || {}) as any;
      return String(cfg.phoneNumberId || '').trim() === payloadPhoneNumberId;
    });
    if (matchByPhoneId) return matchByPhoneId;
  }

  return officialChannels[0];
}

// Middleware para log de todas as requisições ao webhook
router.use('/whatsapp', (req: Request, res: Response, next: Function) => {
  if (isDevLogs) {
    console.log('🔔 [WebhookMiddleware] Requisição recebida:', {
      method: req.method,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl,
      timestamp: new Date().toISOString(),
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });
  }
  next();
});

// ============================================
// WEBHOOK WHATSAPP OFFICIAL API
// ============================================

/**
 * Webhook do WhatsApp Official API
 * GET: Verificação do webhook (handshake)
 * POST: Recebimento de eventos (mensagens, status, etc.)
 */
router.get('/whatsapp', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyTokens = await resolveWebhookVerifyTokens();
  const tokenStr = typeof token === 'string' ? token : '';
  const tokenMatch = verifyTokens.includes(tokenStr);

  console.log('[WebhookWhatsApp] 🔐 ============================================');
  console.log('[WebhookWhatsApp] 🔐 Verificação do webhook (GET)');
  console.log('[WebhookWhatsApp] 🔐 URL:', req.url);
  if (isDevLogs) {
    console.log('[WebhookWhatsApp] 🔐 Query params:', JSON.stringify(req.query, null, 2));
  }
  console.log('[WebhookWhatsApp] 🔐 Mode:', mode);
  console.log('[WebhookWhatsApp] 🔐 Token recebido:', token);
  console.log('[WebhookWhatsApp] 🔐 Total de tokens válidos carregados:', verifyTokens.length);
  console.log('[WebhookWhatsApp] 🔐 Challenge:', challenge);
  console.log('[WebhookWhatsApp] 🔐 ============================================');

  // Se não tem parâmetros, é acesso direto do navegador - retornar info
  if (!mode && !token && !challenge) {
    return res.status(200).json({
      message: 'Webhook endpoint ativo',
      method: 'GET',
      description: 'Este endpoint é usado pelo Meta para verificar o webhook',
      requiredParams: ['hub.mode', 'hub.verify_token', 'hub.challenge'],
      webhookUrl: '/api/webhooks/whatsapp',
    });
  }

  if (mode === 'subscribe' && tokenMatch) {
    console.log('[WebhookWhatsApp] ✅ Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  } else {
    console.warn('[WebhookWhatsApp] ⚠️ Verificação falhou:', {
      mode,
      tokenMatch,
      availableTokens: verifyTokens.length,
    });
    res.status(403).send('Forbidden');
  }
});

router.post('/whatsapp', webhookReceiveLimiter, async (req: Request, res: Response) => {
  try {
    console.log('📨 ============================================');
    console.log('📨 Webhook recebido do WhatsApp Official API');
    console.log('📨 Timestamp:', new Date().toISOString());
    console.log('📨 URL:', req.url);
    console.log('📨 Method:', req.method);
    if (isDevLogs) {
      console.log('📨 Headers:', JSON.stringify(req.headers, null, 2));
      console.log('📨 Body completo:', JSON.stringify(req.body, null, 2));
    } else {
      console.log('📨 Resumo do evento:', {
        hasEntry: Array.isArray(req.body?.entry),
        entryCount: Array.isArray(req.body?.entry) ? req.body.entry.length : 0,
      });
    }
    console.log('📨 ============================================');

    // Validação opcional de assinatura (X-Hub-Signature-256) do WhatsApp/META
    // Preferência: segredo por canal (config da interface). Fallback: .env
    const appSecret = await resolveWebhookAppSecret(req);
    const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

    if (appSecret) {
      if (!signatureHeader) {
        console.warn('[WebhookWhatsApp] ⚠️ Assinatura X-Hub-Signature-256 ausente');
        return res.status(403).json({ error: 'Assinatura do webhook ausente' });
      }

      const expected = crypto
        .createHmac('sha256', appSecret)
        .update((req as any).rawBody || Buffer.from(JSON.stringify(req.body)))
        .digest('hex');

      const expectedSignature = `sha256=${expected}`;

      const provided = signatureHeader.trim();

      const valid =
        provided.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedSignature));

      if (!valid) {
        console.error('[WebhookWhatsApp] ❌ Assinatura inválida no webhook do WhatsApp Official');
        return res.status(403).json({ error: 'Assinatura inválida' });
      }
    } else {
      console.warn('[WebhookWhatsApp] ⚠️ WHATSAPP_APP_SECRET não configurado. Assinatura não será validada.');
    }

    const dedupeKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (
      phase1Flags.webhookIdempotencyEnabled &&
      !idempotencyService.register(`webhook:wa:${dedupeKey}`, 5 * 60_000)
    ) {
      return res.status(200).json({ received: true, deduped: true });
    }

    if (phase1Flags.webhookQueueEnabled) {
      await webhookIngestQueue.enqueue({
        provider: 'whatsapp_official',
        payload: req.body,
        dedupeKey,
      });
      return res.status(200).json({ received: true, queued: true });
    }

    await processWhatsAppOfficialWebhookPayload(req.body);

    // WhatsApp Official requer resposta 200 para confirmar recebimento
    console.log('[WhatsAppOfficial] ✅ Webhook processado com sucesso');
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('❌ Erro ao processar webhook do WhatsApp Official:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Processa mensagem recebida do WhatsApp Official
 */
async function handleWhatsAppOfficialMessage(message: any, value: any) {
  try {
    console.log('[WhatsAppOfficial] 📩 Processando mensagem:', {
      messageId: message.id,
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
    });

    const phoneFromRaw = message.from;
    const phoneNumber = digitsOnlyPhone(phoneFromRaw);
    const messageId = message.id;
    const messageType = message.type;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    if (!messageId || typeof messageId !== 'string') {
      console.warn('[WhatsAppOfficial] ⚠️ Evento sem id de mensagem, ignorando');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      console.warn('[WhatsAppOfficial] ⚠️ Campo from inválido ou curto demais, ignorando:', phoneFromRaw);
      return;
    }

    // Idempotência: a Meta reenvia o webhook em retry; o wamid é único.
    const already = await prisma.message.findFirst({
      where: { externalId: messageId },
      select: { id: true },
    });
    if (already) {
      console.log('[WhatsAppOfficial] ℹ️ Mensagem já registrada (webhook duplicado/retry), ignorando:', messageId);
      return;
    }

    const typeNorm = String(messageType || '').toLowerCase();
    if (WHATSAPP_OFFICIAL_IGNORE_TYPES.has(typeNorm)) {
      console.log('[WhatsAppOfficial] ℹ️ Tipo ignorado (não é mensagem conversacional do cliente):', messageType);
      return;
    }

    // Eco / linha do negócio: se "from" for o mesmo número exibido do WhatsApp Business, não tratar como cliente.
    const businessDigits = digitsOnlyPhone(value?.metadata?.display_phone_number);
    if (businessDigits.length >= 8 && phoneNumber.length >= 8 && businessDigits === phoneNumber) {
      console.log('[WhatsAppOfficial] ℹ️ Ignorando mensagem com remetente = número do negócio (eco/metadata):', {
        from: phoneFromRaw,
        display: value?.metadata?.display_phone_number,
      });
      return;
    }

    // Tentar obter o nome de perfil enviado pelo WhatsApp Official
    // Estrutura padrão: entry[0].changes[0].value.contacts[0].profile.name
    let profileName: string | null = null;
    try {
      const contacts = Array.isArray((value as any)?.contacts)
        ? (value as any).contacts
        : [];
      if (contacts.length > 0) {
        const firstContact = contacts[0] || {};
        profileName =
          (firstContact.profile && firstContact.profile.name) ||
          (typeof firstContact.wa_id === 'string' ? firstContact.wa_id : null);
      }
    } catch (profileError) {
      console.warn(
        '[WhatsAppOfficial] ⚠️ Não foi possível extrair profile.name do payload:',
        (profileError as any)?.message,
      );
    }

    // Resolve canal oficial correto a partir do phone_number_id do payload.
    // Isso evita criar conversa sem canal quando existir contato legado órfão.
    let whatsappChannel = await resolveWhatsAppOfficialChannel(value);
    if (!whatsappChannel) {
      console.log('[WhatsAppOfficial] ⚠️ Canal WhatsApp Official não encontrado. Criando automaticamente...');
      try {
        whatsappChannel = await prisma.channel.create({
          data: {
            name: 'WhatsApp Official',
            type: 'WHATSAPP',
            status: 'ACTIVE',
            config: {
              provider: 'whatsapp_official',
              phoneNumberId: value?.metadata?.phone_number_id || process.env.WHATSAPP_DEV_PHONE_NUMBER_ID,
              businessAccountId: process.env.WHATSAPP_DEV_WABA_ID,
            },
          },
        });
      } catch (createError: any) {
        console.error('[WhatsAppOfficial] ❌ Erro ao criar canal automaticamente:', createError);
        return;
      }
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      console.error('[WhatsAppOfficial] ❌ Telefone inválido:', phoneNumber);
      return;
    }

    const contact = await contactResolutionService.resolveContactByPhone({
      phone: normalizedPhone,
      name: profileName || normalizedPhone,
      channelId: whatsappChannel.id,
      externalId: normalizedPhone,
      provider: 'whatsapp_official',
    });

    const channelWithSector = await prisma.channel.findUnique({
      where: { id: whatsappChannel.id },
      include: { sector: true },
    });
    if (!channelWithSector) {
      console.error('[WhatsAppOfficial] ❌ Canal não encontrado após resolução');
      return;
    }

    const resolved = await conversationResolutionService.resolveOpenConversation(
      contact.id,
      channelWithSector,
      {
        sectorId: channelWithSector.sectorId ?? null,
        lastMessageAt: timestamp,
        lastCustomerMessageAt: timestamp,
        initialUnread: 1,
        reopenIfClosed: true,
      },
    );

    let conversation = resolved.conversation;
    if (!resolved.created && !resolved.reopened) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          lastMessageAt: timestamp,
          lastCustomerMessageAt: timestamp,
          unreadCount: { increment: 1 },
        },
      });
    }

    // Bot primeiro na criação/reabertura; distribuição humana só se não houver bot ativo.
    if (resolved.created || resolved.reopened) {
      const dealOnCreate = await prisma.deal
        .findUnique({ where: { conversationId: conversation.id } })
        .catch(() => null);
      let botStarted = false;
      if (!dealOnCreate) {
        botStarted = await conversationService.tryActivateBotForConversation(conversation.id);
        if (botStarted) {
          const refreshed = await prisma.conversation.findUnique({
            where: { id: conversation.id },
          });
          if (refreshed) conversation = refreshed;
          console.log(
            `[WhatsAppOfficial] 🤖 Bot ativado automaticamente na conversa ${conversation.id}`,
          );
        }
      }
      if (!botStarted && !conversation?.assignedToId) {
        try {
          const distributionService = new ConversationDistributionService();
          const assignedUserId = await distributionService.distributeConversation(conversation.id, {
            channelId: whatsappChannel.id,
          });
          if (assignedUserId) {
            conversation = await prisma.conversation.update({
              where: { id: conversation.id },
              data: { assignedToId: assignedUserId },
            });
          } else {
            console.log(
              '[WhatsAppOfficial] ℹ️ Nenhum usuário disponível; conversa ficou em WAITING (fila):',
              conversation.id,
            );
          }
        } catch (distributionError: any) {
          console.error(
            '[WhatsAppOfficial] ❌ Erro ao distribuir conversa automaticamente:',
            distributionError?.message || distributionError,
          );
        }
      }
    } else if (!conversation.assignedToId) {
      const activeBot = await prisma.botSession.findUnique({
        where: { conversationId: conversation.id },
        select: { isActive: true },
      });
      if (!activeBot?.isActive) {
        try {
          const distributionService = new ConversationDistributionService();
          await distributionService.distributeConversation(conversation.id, {
            channelId: whatsappChannel.id,
          });
        } catch (distributionError: any) {
          console.error(
            '[WhatsAppOfficial] ❌ Erro ao redistribuir conversa:',
            distributionError?.message || distributionError,
          );
        }
      }
    }

    if (
      messageType === 'interactive' &&
      (message.interactive?.type === 'list_reply' || message.interactive?.list_reply)
    ) {
      const listReplyId = String(message.interactive?.list_reply?.id || '').trim();
      if (listReplyId.startsWith('sat:')) {
        const result = await satisfactionSurveyService.handleOfficialListReply({
          conversationId: conversation.id,
          listReplyId,
          externalMessageId: messageId,
          receivedAt: timestamp,
          assignedToId: conversation.assignedToId,
          contactId: contact.id,
          channelId: whatsappChannel.id,
        });
        if (result.handled) {
          if (io) {
            emitConversationDelta(io, 'new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            emitConversationDelta(io, 'conversation_updated', {
              conversationId: conversation.id,
            });
          }
          return;
        }
      }
    }

    // Extrair conteúdo da mensagem baseado no tipo
    let messageContent = '';
    let messageTypeDb = 'TEXT';
    let mediaUrl: string | null = null;

    let mediaId: string | null = null;

    switch (messageType) {
      case 'text':
        messageContent = message.text?.body || '';
        messageTypeDb = 'TEXT';
        break;
      case 'button':
        messageContent =
          message.button?.text || message.button?.payload || message.button?.title || '';
        messageTypeDb = 'TEXT';
        break;
      case 'interactive':
        messageContent =
          message.interactive?.button_reply?.title ||
          message.interactive?.button_reply?.id ||
          message.interactive?.list_reply?.title ||
          message.interactive?.list_reply?.id ||
          '';
        messageTypeDb = 'TEXT';
        break;
      case 'image':
        messageContent = message.image?.caption || '';
        messageTypeDb = 'IMAGE';
        // Para WhatsApp Official, a URL direta vem em image.url e o ID em image.id
        mediaUrl = message.image?.url || null;
        mediaId = message.image?.id || null;
        break;
      case 'video':
        messageContent = message.video?.caption || '';
        messageTypeDb = 'VIDEO';
        mediaUrl = message.video?.url || null;
        mediaId = message.video?.id || null;
        break;
      case 'audio':
        messageContent = '';
        messageTypeDb = 'AUDIO';
        mediaUrl = message.audio?.url || null;
        mediaId = message.audio?.id || null;
        break;
      case 'document':
        messageContent = message.document?.caption || message.document?.filename || '';
        messageTypeDb = 'DOCUMENT';
        mediaUrl = message.document?.url || null;
        mediaId = message.document?.id || null;
        break;
      default:
        console.log(
          '[WhatsAppOfficial] ℹ️ Tipo não mapeado para persistência, ignorando (evita “fantasma” no chat):',
          messageType,
        );
        return;
    }

    if (messageType === 'text') {
      const trimmed = String(messageContent || '').trim();
      if (/^[1-5]$/.test(trimmed)) {
        const score = parseInt(trimmed, 10);
        const result = await satisfactionSurveyService.tryConsumeTextSurveyReply({
          conversationId: conversation.id,
          score,
          externalMessageId: messageId,
          receivedAt: timestamp,
          assignedToId: conversation.assignedToId,
          contactId: contact.id,
          channelId: whatsappChannel.id,
          provider: 'whatsapp_official',
        });
        if (result.handled) {
          if (io) {
            emitConversationDelta(io, 'new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            emitConversationDelta(io, 'conversation_updated', {
              conversationId: conversation.id,
            });
          }
          return;
        }
      }
    }

    // Evita gravar bolha vazia para tipos que exigem corpo (texto/botão/interativo).
    if (
      (messageType === 'text' || messageType === 'button' || messageType === 'interactive') &&
      (!messageContent || !String(messageContent).trim())
    ) {
      console.log('[WhatsAppOfficial] ℹ️ Mensagem sem conteúdo útil, ignorando:', messageType);
      return;
    }

    // Metadata de mídia: nunca gravar a URL assinada da Meta como "mediaId" — ela expira em pouco tempo
    // e quebra o GET no Graph (`/{media-id}`). Só persiste mediaId quando for o ID real do Graph.
    const mediaMeta: Record<string, string> = {};
    if (mediaUrl) mediaMeta.mediaUrl = mediaUrl;
    if (mediaId && !/^https?:\/\//i.test(String(mediaId))) {
      mediaMeta.mediaId = mediaId;
    }

    // Criar mensagem no banco
    const createdMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: null, // Mensagem do cliente
        content: messageContent,
        type: messageTypeDb as any,
        status: 'PENDING', // Mensagem recebida, será processada
        externalId: messageId,
        metadata: Object.keys(mediaMeta).length > 0 ? mediaMeta : undefined,
      },
    });
    await dispatchJourneyEvent('message_received', {
      contactId: contact.id,
      channelId: whatsappChannel.id,
      conversationId: conversation.id,
      messageContent,
    });
    invalidateConversationMetricsCache();

    console.log('[WhatsAppOfficial] ✅ Mensagem salva:', {
      messageId: createdMessage.id,
      conversationId: conversation.id,
    });

    // Processar com bot se houver
    // - Para texto: usa o próprio conteúdo
    // - Para mídia (imagem, documento, áudio, vídeo...): usa caption/nome ou um marcador padrão
    const normalizedInput =
      messageType === 'text'
        ? messageContent
        : messageContent || `[${messageType.toUpperCase()}]`;

    if (normalizedInput) {
      try {
        const freshConversation = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { assignedToId: true },
        });
        const currentBotSession = await prisma.botSession.findUnique({
          where: { conversationId: conversation.id },
          select: { isActive: true },
        });
        if (!freshConversation?.assignedToId && !currentBotSession?.isActive) {
          await conversationService.tryActivateBotForConversation(conversation.id);
        }

        if (phase1Flags.botQueueEnabled) {
          await botProcessQueue.enqueue(normalizedInput, conversation.id, {
            messageType: messageType.toLowerCase(),
            mediaUrl,
            mediaId,
            provider: 'whatsapp_official',
          });
        } else {
          await botService.processMessage(normalizedInput, conversation.id, {
            messageType: messageType.toLowerCase(),
            mediaUrl,
            mediaId,
            provider: 'whatsapp_official',
          });
        }
      } catch (botError: any) {
        console.error('[WhatsAppOfficial] ❌ Erro ao processar com bot:', botError);
      }
    }

    // Emitir evento para n8n (webhooks configurados) apenas se a conversa não estiver atribuída a um humano
    if (!conversation.assignedToId) {
      try {
        await webhookService.emitEvent(
          'message.received',
          {
            messageId: createdMessage.id,
            conversationId: conversation.id,
            contactId: contact.id,
            channelId: whatsappChannel.id,
            content: messageContent,
            type: messageTypeDb,
            fromMe: false,
            metadata: {
              phone: contact.phone,
              contactName: contact.name,
              provider: 'whatsapp_official',
            },
          },
          whatsappChannel.id || undefined,
        );
      } catch (webhookError: any) {
        console.error(
          '[WhatsAppOfficial] ❌ Erro ao emitir evento para n8n (WhatsApp Official):',
          webhookError.message,
        );
      }
    } else {
      console.log(
        '[WhatsAppOfficial] ℹ️ Conversa atribuída a humano, não emitir evento para n8n:',
        conversation.id,
      );
    }

    // Emitir evento via Socket.IO
    if (io) {
      emitConversationDelta(io, 'new_message', {
        conversationId: conversation.id,
        channelId: whatsappChannel.id,
        messageId: createdMessage.id,
      });
      emitConversationDelta(io, 'conversation_updated', {
        conversationId: conversation.id,
        channelId: whatsappChannel.id,
      });
    }
  } catch (error: any) {
    console.error('[WhatsAppOfficial] ❌ Erro ao processar mensagem:', error);
  }
}

/**
 * Processa status de mensagem (delivered, read, etc.)
 */
async function handleWhatsAppOfficialStatus(status: any) {
  try {
    console.log('[WhatsAppOfficial] 📊 Processando status:', {
      messageId: status.id,
      status: status.status,
      timestamp: status.timestamp,
      hasErrors: Array.isArray(status.errors) && status.errors.length > 0,
    });

    if (status.id) {
      const mappedStatus =
        status.status === 'delivered'
          ? 'DELIVERED'
          : status.status === 'read'
          ? 'READ'
          : status.status === 'failed'
          ? 'FAILED'
          : 'SENT';

      const webhookSendError =
        mappedStatus === 'FAILED' ? extractWhatsAppWebhookStatusError(status) : null;

      const affectedMessages = await prisma.message.findMany({
        where: {
          externalId: status.id,
        },
        select: {
          id: true,
          conversationId: true,
          metadata: true,
        },
      });

      for (const msg of affectedMessages) {
        const updateData: {
          status: typeof mappedStatus;
          metadata?: Record<string, unknown>;
        } = {
          status: mappedStatus as any,
        };

        if (webhookSendError) {
          const existingMetadata =
            msg.metadata && typeof msg.metadata === 'object'
              ? (msg.metadata as Record<string, unknown>)
              : {};
          updateData.metadata = {
            ...existingMetadata,
            sendError: {
              message: webhookSendError.message,
              code: webhookSendError.code ?? null,
              details: webhookSendError.details ?? null,
              errorSubcode: webhookSendError.errorSubcode ?? null,
              type: webhookSendError.type ?? null,
              source: 'webhook',
              at: new Date().toISOString(),
            },
          };
        }

        await prisma.message.update({
          where: { id: msg.id },
          data: {
            status: mappedStatus as any,
            ...(updateData.metadata ? { metadata: updateData.metadata as any } : {}),
          },
        });

        if (io) {
          emitMessageStatus(io, {
            conversationId: msg.conversationId,
            messageId: msg.id,
            status: mappedStatus,
            sendError: updateData.metadata?.sendError as Record<string, unknown> | undefined,
          });
        }

        if (mappedStatus === 'FAILED' && webhookSendError) {
          const mergedMetadata = (updateData.metadata || msg.metadata) as Record<string, unknown> | null;
          const flowStepId = mergedMetadata?.flowStepId;
          if (mergedMetadata?.fromBot && flowStepId) {
            void botService.handleFlowMessageSendFailure({
              conversationId: msg.conversationId,
              messageId: msg.id,
              flowStepId: String(flowStepId),
              sendError: webhookSendError,
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[WhatsAppOfficial] ❌ Erro ao processar status:', error);
  }
}

// ============================================
// WEBHOOK EVOLUTION API (EXISTENTE)
// ============================================

// Webhook da Evolution API - Rota principal
router.post('/evolution', webhookReceiveLimiter, async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('📨 ============================================');
    console.log('📨 Webhook recebido da Evolution API');
    console.log('📨 Timestamp:', new Date().toISOString());
    console.log('📨 Event:', event.event || event.eventName || event.eventType);
    console.log('📨 Data keys:', Object.keys(event.data || event));
    if (isDevLogs) {
      console.log('📨 Body completo:', JSON.stringify(event, null, 2));
    }
    console.log('📨 ============================================');

    const dedupeKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex');

    if (
      phase1Flags.webhookIdempotencyEnabled &&
      !idempotencyService.register(`webhook:evolution:${dedupeKey}`, 5 * 60_000)
    ) {
      return res.status(200).json({ received: true, deduped: true });
    }

    if (phase1Flags.webhookQueueEnabled) {
      await webhookIngestQueue.enqueue({
        provider: 'evolution',
        payload: event,
        dedupeKey,
      });
      return res.status(200).json({ received: true, queued: true });
    }

    await processEvolutionWebhookWithRouting(event, 'evolution');

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Evolution] ❌ Erro ao processar webhook:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Webhook Evolution GO — rota dedicada (não misturar com Evolution API Node)
router.post('/evolution-go', webhookReceiveLimiter, async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const prefix = evolutionWebhookLogPrefix('evolution_go');
    console.log(`${prefix} ============================================`);
    console.log(`${prefix} Webhook POST /webhooks/evolution-go`);
    console.log(`${prefix} Timestamp:`, new Date().toISOString());
    console.log(`${prefix} Event:`, event.event || event.eventName || event.eventType);
    console.log(`${prefix} Instance:`, extractEvolutionInstanceName(event), extractEvolutionInstanceUuid(event));
    console.log(`${prefix} Data keys:`, Object.keys(event.data || event));
    if (isDevLogs) {
      console.log(`${prefix} Body completo:`, JSON.stringify(event, null, 2));
    }
    console.log(`${prefix} ============================================`);

    const dedupeKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex');

    if (
      phase1Flags.webhookIdempotencyEnabled &&
      !idempotencyService.register(`webhook:evolution-go:${dedupeKey}`, 5 * 60_000)
    ) {
      return res.status(200).json({ received: true, deduped: true });
    }

    if (phase1Flags.webhookQueueEnabled) {
      await webhookIngestQueue.enqueue({
        provider: 'evolution_go',
        payload: event,
        dedupeKey,
      });
      return res.status(200).json({ received: true, queued: true });
    }

    await processEvolutionWebhookWithRouting(event, 'evolution_go');

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[EvolutionGO] ❌ Erro ao processar webhook:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewMessage(data: any, eventTypeHint?: string) {
  try {
    const bundles = extractIncomingMessageBundles(data, eventTypeHint);
    if (bundles.length > 1) {
      for (let i = 1; i < bundles.length; i++) {
        const b = bundles[i];
        await handleNewMessage(
          {
            ...data,
            ...b,
            message: b.message,
            key: b.key,
            instance: b.instance ?? data.instance,
            instanceName: b.instanceName ?? data.instanceName,
            instanceId: b.instanceId ?? data.instanceId,
            pushName: b.pushName ?? data.pushName,
            messageType: b.messageType ?? data.messageType,
            body: b.body ?? data.body,
            [CRM_WEBHOOK_SOURCE_KEY]: data[CRM_WEBHOOK_SOURCE_KEY],
          },
          eventTypeHint,
        );
      }
    }

    let message: any;
    let messageKey: Record<string, unknown> | null;

    if (bundles.length >= 1) {
      const b = bundles[0];
      message = b.message;
      messageKey = b.key;
      if (b.instance) data.instance = data.instance ?? b.instance;
      if (b.instanceName) data.instanceName = data.instanceName ?? b.instanceName;
      if (b.instanceId) data.instanceId = data.instanceId ?? b.instanceId;
      if (b.pushName) data.pushName = data.pushName ?? b.pushName;
      if (b.messageType) data.messageType = data.messageType ?? b.messageType;
      if (b.body) data.body = data.body ?? b.body;
      console.log('📩 [handleNewMessage] Bundle Evolution normalizado (GO/Node)');
    } else if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      message = data.messages[0];
      messageKey = normalizeEvolutionMessageKey(message.key || data.key);
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.messages[0]');
    } else if (data.message) {
      message = data.message;
      messageKey = normalizeEvolutionMessageKey(message.key || data.key);
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.message');
    } else if (data.key || data.Key) {
      message = data;
      messageKey = normalizeEvolutionMessageKey(data.key || data.Key);
      console.log('📩 [handleNewMessage] Mensagem encontrada diretamente em data');
    } else {
      console.log('⚠️ [handleNewMessage] Nenhuma mensagem encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Estrutura recebida:', JSON.stringify(data, null, 2).substring(0, 500));
      return;
    }

    console.log('📩 [handleNewMessage] Processando nova mensagem...');
    console.log('📩 [handleNewMessage] Data keys:', Object.keys(data));
    
    const rawFromMe =
      messageKey?.fromMe ??
      data.key?.fromMe ??
      (message as any).fromMe ??
      (data as any).fromMe;

    console.log('📩 [handleNewMessage] Processando mensagem:', {
      hasMessageKey: !!messageKey,
      fromMe: rawFromMe,
      remoteJid:
        (messageKey?.remoteJid as string) ||
        message.from ||
        (data.key?.remoteJid as string) ||
        (data.key?.remoteJID as string),
      messageId: (messageKey?.id as string) || data.key?.id || data.key?.ID,
      eventTypeHint: eventTypeHint || undefined,
    });
    
    // Ignorar mensagens enviadas pelo próprio sistema (fromMe)
    const fromMe =
      rawFromMe === true || rawFromMe === 'true' || rawFromMe === 1 || rawFromMe === '1';
    if (fromMe) {
      console.log('ℹ️ [handleNewMessage] Mensagem ignorada (enviada pelo sistema)');
      return;
    }

    const instanceName = data.instance || data.instanceName || null;
    const instanceUuid = data.instanceId ? String(data.instanceId) : null;
    if (!instanceName && !instanceUuid) {
      console.log('⚠️ [handleNewMessage] Instância não encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Data keys disponíveis:', Object.keys(data));
      return;
    }

    const webhookSource = getWebhookSourceFromEventData(data);
    const logPrefix = evolutionWebhookLogPrefix(webhookSource);

    console.log(`${logPrefix} Instância no webhook:`, { instanceName, instanceUuid, webhookSource });

    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );

    if (!channel) {
      await logWebhookChannelMiss(instanceName, instanceUuid, webhookSource);
      return;
    }

    if (channel.status !== 'ACTIVE' && isBaileysWhatsAppChannel(channel.config as Record<string, unknown>)) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'ACTIVE' },
      });
      console.log('[Webhook] ✅ Canal marcado ACTIVE (mensagem recebida):', channel.name);
      if (io) {
        emitChannelStatusUpdate(io, { channelId: channel.id, status: 'ACTIVE' });
      }
    }

    // Extrair número do telefone
    // O remoteJid pode estar em message.key.remoteJid, message.from, ou data.key.remoteJid
    // Quando message = data.message, o key está em data.key, não em message.key
    let remoteJid =
      (messageKey?.remoteJid as string) ||
      message.from ||
      (data.key?.remoteJid as string) ||
      (data.key?.remoteJID as string) ||
      message.remoteJid;
    
    if (!remoteJid) {
      console.log('⚠️ [handleNewMessage] RemoteJid não encontrado na mensagem');
      console.log('⚠️ [handleNewMessage] Message keys:', Object.keys(message));
      console.log('⚠️ [handleNewMessage] MessageKey:', messageKey ? Object.keys(messageKey) : 'null');
      console.log('⚠️ [handleNewMessage] Data keys:', Object.keys(data));
      return;
    }

    console.log('📩 [handleNewMessage] RemoteJid encontrado:', remoteJid);
    
    // Ignorar mensagens de grupos (@g.us) — CRM atende conversas 1:1
    if (remoteJid.includes('@g.us')) {
      console.log(
        `${logPrefix} Mensagem de grupo ignorada (canal "${channel.name}", instância ${instanceName || instanceUuid}):`,
        remoteJid,
      );
      return;
    }
    
    // LIDs (Linked Device IDs) - ex: 60168398209059@lid
    // Em alguns webhooks o número real vem em key.senderPn (ex: "559889182653@s.whatsapp.net")
    if (remoteJid.includes('@lid')) {
      console.log('⚠️ [handleNewMessage] RemoteJid é um LID:', remoteJid);
      
      const senderPn =
        (data.key && (data.key.senderPn || data.key.participant)) ||
        (messageKey && (messageKey as any).senderPn);

      if (senderPn && typeof senderPn === 'string') {
        console.log('📱 [handleNewMessage] Usando senderPn como fallback para número real:', senderPn);
        remoteJid = senderPn;
      } else {
        console.log('⚠️ [handleNewMessage] LID sem senderPn, ignorando mensagem. LIDs não são números de telefone válidos');
        return;
      }
    }
    
    // Garantir que é um número de telefone real (deve terminar com @s.whatsapp.net ou @c.us)
    if (!remoteJid.includes('@s.whatsapp.net') && !remoteJid.includes('@c.us')) {
      console.log('⚠️ [handleNewMessage] RemoteJid não é um número de telefone válido:', remoteJid);
      console.log('⚠️ [handleNewMessage] Esperado formato: número@s.whatsapp.net ou número@c.us');
      return;
    }
    
    // Extrair número do telefone (remover @s.whatsapp.net, @c.us)
    // Garantir que só pegue números válidos
    let phone = remoteJid.replace('@s.whatsapp.net', '')
                          .replace('@c.us', '')
                          .trim();
    
    // Validar que o phone é um número válido (apenas dígitos)
    if (!/^\d+$/.test(phone)) {
      console.log('⚠️ [handleNewMessage] Número extraído não é válido (contém caracteres não numéricos):', phone);
      console.log('⚠️ [handleNewMessage] RemoteJid original:', remoteJid);
      return;
    }
    
    console.log('✅ [handleNewMessage] Número de telefone válido extraído:', phone);
    
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      console.error('❌ [handleNewMessage] Telefone inválido:', phone);
      return;
    }

    // Buscar foto de perfil do WhatsApp
    let profilePicture: string | null = null;
    try {
      const apiKey = resolveBaileysApiKey(channel);
      if (channel.evolutionInstanceId && apiKey && normalizedPhone) {
        const baileysApi = getBaileysApi(channel);
        const whatsappNumber = `${normalizedPhone}@s.whatsapp.net`;
        profilePicture = await baileysApi.getProfilePicture(
          channel.evolutionInstanceId,
          whatsappNumber,
          apiKey,
        );
        if (profilePicture) {
          console.log('📸 [handleNewMessage] Foto de perfil obtida:', profilePicture.substring(0, 100));
        }
      }
    } catch (profileError: any) {
      console.warn('⚠️ [handleNewMessage] Erro ao buscar foto de perfil:', profileError.message);
      // Continuar mesmo se falhar
    }

    const contactName = data.pushName || message.pushName || message.notifyName || normalizedPhone;
    const contact = await contactResolutionService.resolveContactByPhone({
      phone: normalizedPhone,
      name: contactName,
      channelId: channel.id,
      externalId: normalizedPhone,
      profilePicture,
      provider: contactResolutionService.resolveProviderFromChannel(channel),
    });

    const msgKeyForLid = (data.key || messageKey) as Record<string, unknown> | undefined;
    const lidJids = [
      msgKeyForLid?.remoteJidAlt,
      msgKeyForLid?.participant,
      msgKeyForLid?.remoteJid,
    ].filter((v): v is string => typeof v === 'string' && v.includes('@lid'));
    for (const lidJid of lidJids) {
      await contactResolutionService.upsertLidIdentity({
        contactId: contact.id,
        channelId: channel.id,
        lidJid,
        provider: contactResolutionService.resolveProviderFromChannel(channel),
      });
    }

    const channelWithSector = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: { sector: true },
    });

    const now = new Date();
    const resolved = await conversationResolutionService.resolveOpenConversation(
      contact.id,
      channel,
      {
        sectorId: channelWithSector?.sectorId ?? null,
        lastMessageAt: now,
        lastCustomerMessageAt: now,
        initialUnread: 1,
        reopenIfClosed: true,
      },
    );

    let conversation: any = resolved.conversation;
    const channelInclude = {
      channel: { include: { sector: true } },
    };

    if (!resolved.created && !resolved.reopened) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          unreadCount: { increment: 1 },
          lastMessageAt: now,
          lastCustomerMessageAt: now,
        },
        include: channelInclude,
      });
    } else {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: channelInclude,
      });
    }

    if (resolved.created || resolved.reopened) {
      // Bot primeiro: só distribui para humano se não houver bot configurado/ativo no setor.
      const dealOnCreate = await prisma.deal
        .findUnique({ where: { conversationId: conversation.id } })
        .catch(() => null);
      let botStarted = false;
      if (!dealOnCreate) {
        botStarted = await conversationService.tryActivateBotForConversation(conversation.id);
        if (botStarted) {
          const refreshed = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: channelInclude,
          });
          if (refreshed) conversation = refreshed;
          console.log(
            `🤖 [handleNewMessage] Bot ativado automaticamente na conversa ${conversation.id}`,
          );
        }
      }
      if (!botStarted && !conversation?.assignedToId) {
        try {
          const distributionService = new ConversationDistributionService();
          const assignedUserId = await distributionService.distributeConversation(conversation.id, {
            channelId: channel.id,
            sectorId: channelWithSector?.sectorId || undefined,
          });
          if (assignedUserId) {
            conversation = await prisma.conversation.update({
              where: { id: conversation.id },
              data: { assignedToId: assignedUserId },
              include: channelInclude,
            });
          }
        } catch (error: any) {
          console.error(`❌ [handleNewMessage] Erro ao distribuir conversa ${conversation.id}:`, error.message);
        }
      }
    } else if (!conversation.assignedToId) {
      const activeBot = await prisma.botSession.findUnique({
        where: { conversationId: conversation.id },
        select: { isActive: true },
      });
      if (!activeBot?.isActive) {
        try {
          const distributionService = new ConversationDistributionService();
          await distributionService.distributeConversation(conversation.id, {
            channelId: channel.id,
            sectorId: channelWithSector?.sectorId || undefined,
          });
        } catch (error: any) {
          console.error(`❌ [handleNewMessage] Erro ao redistribuir conversa ${conversation.id}:`, error.message);
        }
      }
    }

    if (!conversation) {
      throw new Error('Conversa não foi possível ser carregada/criada');
    }

    const msgObj = message.message || message;
    const parsed = parseEvolutionMessageContent(msgObj, {
      messageType: data.messageType,
      root: data,
      body: message.body,
    });

    if (parsed.skip) {
      console.log('ℹ️ [handleNewMessage] Evento ignorado (sem conteúdo conversacional):', {
        reason: parsed.reason,
        evolutionMessageType: data.messageType,
        messageKeys: Object.keys(msgObj || {}),
      });
      return;
    }

    let messageContent = parsed.content;
    let messageType = parsed.messageType;
    let mediaUrl: string | null = parsed.mediaUrl ?? null;
    let mediaMetadata: any = parsed.mediaMetadata ?? null;

    if (messageContent === '[Mensagem não suportada]') {
      console.warn('[handleNewMessage] Tipo de mensagem não mapeado:', {
        evolutionMessageType: data.messageType,
        messageKeys: Object.keys(msgObj || {}),
      });
    } else if (mediaMetadata?.evolutionInteractiveReply) {
      console.log('[handleNewMessage] Resposta interativa (botão/lista):', {
        selectedId: mediaMetadata.botInputId,
        displayText: messageContent,
        replyType: mediaMetadata.evolutionInteractiveReply.replyType,
        evolutionMessageType: data.messageType,
      });
    }

    // Verificar se mensagem já existe (evitar duplicatas)
    const messageId =
      (messageKey?.id as string) || data.key?.id || data.key?.ID || undefined;

    if (messageType === 'TEXT' && messageId) {
      const t = String(messageContent || '').trim();
      if (/^[1-5]$/.test(t)) {
        const score = parseInt(t, 10);
        const result = await satisfactionSurveyService.tryConsumeTextSurveyReply({
          conversationId: conversation.id,
          score,
          externalMessageId: messageId,
          receivedAt: new Date(),
          assignedToId: conversation.assignedToId,
          contactId: contact.id,
          channelId: channel.id,
          provider: 'evolution',
        });
        if (result.handled) {
          if (io) {
            emitConversationDelta(io, 'new_message', {
              conversationId: conversation.id,
              channelId: channel.id,
              messageId: result.messageId,
            });
            emitConversationDelta(io, 'conversation_updated', {
              conversationId: conversation.id,
              channelId: channel.id,
            });
          }
          return;
        }
      }
    }

    const existingMessage = await prisma.message.findFirst({
      where: {
        externalId: messageId,
        conversationId: conversation.id,
      },
    });
    
    if (existingMessage) {
      console.log('ℹ️ [handleNewMessage] Mensagem já existe, ignorando duplicata:', messageId);
      return;
    }

    if (!existingMessage) {
      // Preparar metadata completo
      const fullMetadata: any = {
        ...data,
        ...message,
        key: messageKey || data.key,
        message: msgObj,
        mediaUrl: mediaUrl,
        mediaMetadata: mediaMetadata,
      };

      const createdMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: messageContent,
          type: messageType as any,
          status: 'DELIVERED',
          externalId: messageId,
          metadata: fullMetadata,
        },
      });
      if (!fromMe) {
        await dispatchJourneyEvent('message_received', {
          contactId: contact.id,
          channelId: channel.id,
          conversationId: conversation.id,
          messageContent,
        });
      }
      invalidateConversationMetricsCache();
      
      console.log('✅ [handleNewMessage] Mensagem criada com sucesso:', {
        messageId: createdMessage.id,
        conversationId: conversation.id,
        content: messageContent.substring(0, 50),
        type: messageType,
      });

      if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(messageType)) {
        const persistPort = process.env.PORT || 3007;
        setImmediate(() => {
          import('axios')
            .then(({ default: axios }) =>
              axios.get(`http://127.0.0.1:${persistPort}/api/media/${createdMessage.id}`, {
                responseType: 'arraybuffer',
                timeout: 180_000,
                validateStatus: () => true,
              }),
            )
            .then((res) => {
              if (res.status === 200) {
                console.log(
                  `[handleNewMessage] Mídia Evolution persistida messageId=${createdMessage.id}`,
                );
              } else {
                console.warn(
                  `[handleNewMessage] Persistência mídia HTTP ${res.status} messageId=${createdMessage.id}`,
                );
              }
            })
            .catch((err) => {
              console.warn(
                `[handleNewMessage] Falha ao persistir mídia messageId=${createdMessage.id}:`,
                err?.message,
              );
            });
        });
      }

      // Verificar se há bot ativo e processar mensagem
      if (!fromMe && messageContent) {
        try {
          const deal = conversation.id
            ? await prisma.deal.findUnique({ where: { conversationId: conversation.id } }).catch(() => null)
            : null;
          const freshConversation = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            select: { assignedToId: true },
          });
          const currentBotSession = await prisma.botSession.findUnique({
            where: { conversationId: conversation.id },
            select: { isActive: true },
          });
          // Autoativar bot quando não há deal, sem humano atribuído e sem sessão ativa.
          if (!deal && !freshConversation?.assignedToId && !currentBotSession?.isActive) {
            const activated = await conversationService.tryActivateBotForConversation(conversation.id);
            if (activated) {
              console.log(`🤖 [handleNewMessage] Bot ativado antes de processar mensagem ${conversation.id}`);
            }
          }

          if (phase1Flags.botQueueEnabled) {
            await botProcessQueue.enqueue(messageContent, conversation.id, {
              messageType: messageType.toLowerCase(),
              provider: 'evolution',
            });
          } else {
            const botResult = await botService.processMessage(messageContent, conversation.id, {
              messageType: messageType.toLowerCase(),
              provider: 'evolution',
              botInputId:
                typeof mediaMetadata?.botInputId === 'string' ? mediaMetadata.botInputId : undefined,
              interactiveReply: mediaMetadata?.evolutionInteractiveReply,
            });
            if (botResult) {
              console.log('🤖 [handleNewMessage] Bot processou mensagem:', botResult);
              // Se o bot respondeu, não precisa emitir para n8n (ou pode emitir também)
            }
          }
        } catch (botError: any) {
          console.error('❌ [handleNewMessage] Erro ao processar com bot:', botError.message);
          // Continuar mesmo se o bot falhar
        }
      }

      // Emitir evento para n8n (webhooks configurados)
      if (!fromMe) {
        try {
          await webhookService.emitEvent('message.received', {
            messageId: createdMessage.id,
            conversationId: conversation.id,
            contactId: contact.id,
            channelId: channel.id,
            content: messageContent,
            type: messageType,
            fromMe: false,
            metadata: {
              phone: contact.phone,
              contactName: contact.name,
            },
          }, channel.id);
        } catch (webhookError: any) {
          console.error('❌ [handleNewMessage] Erro ao emitir evento para n8n:', webhookError.message);
          // Continuar mesmo se webhook falhar
        }
      }

      // Emitir evento via Socket.IO se disponível
      if (io) {
        try {
          emitConversationDelta(io, 'new_message', {
            conversationId: conversation.id,
            channelId: channel.id,
            messageId: createdMessage.id,
          });
          emitConversationDelta(io, 'conversation_updated', {
            conversationId: conversation.id,
            channelId: channel.id,
          });
          console.log('📢 Eventos Socket.IO emitidos: new_message e conversation_updated');
        } catch (socketError) {
          console.error('Erro ao emitir evento Socket.IO:', socketError);
        }
      } else {
        console.log('Socket.IO não disponível para emitir evento');
      }

      console.log('✅ Mensagem processada:', {
        conversationId: conversation.id,
        type: messageType,
        content: messageContent.substring(0, 50),
        hasMedia: !!mediaUrl,
        externalId: messageId,
      });
    } else {
      console.log('Mensagem duplicada ignorada:', message.key?.id);
    }
  } catch (error: any) {
    console.error('Erro ao processar nova mensagem:', error);
    console.error('Stack:', error.stack);
  }
}

async function handleConnectionUpdate(data: any) {
  try {
    const payload = normalizeEvolutionConnectionPayload(data);
    const instanceName =
      (payload.instance as string) ||
      (payload.instanceName as string) ||
      null;
    const instanceUuid = payload.instanceId ? String(payload.instanceId) : null;
    const state = String(
      payload.state || payload.status || payload.connectionStatus || '',
    );
    
    console.log('[Webhook] 📡 Evento de conexão recebido:', {
      instanceName,
      instanceUuid,
      state,
      dataKeys: Object.keys(data),
      fullData: JSON.stringify(data).substring(0, 500),
    });

    if (!instanceName && !instanceUuid) {
      console.warn('[Webhook] ⚠️ Instância não encontrada no evento de conexão');
      return;
    }

    const webhookSource = getWebhookSourceFromEventData(payload);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );

    if (!channel) {
      await logWebhookChannelMiss(instanceName, instanceUuid, webhookSource);
      return;
    }

    // Normalizar estado - Evolution API pode enviar em diferentes formatos
    const normalizedState = (state || '').toLowerCase();
    const hasJid = !!(payload.jid || payload.myJid || payload.Jid);
    const isConnected =
      payload.connected === true ||
      payload.loggedIn === true ||
      payload.LoggedIn === true ||
      hasJid ||
      normalizedState === 'open' ||
      normalizedState === 'connected' ||
      normalizedState === 'ready' ||
      normalizedState === 'authenticated';
    const isDisconnected = normalizedState === 'close' || 
                          normalizedState === 'closed' || 
                          normalizedState === 'disconnected' ||
                          normalizedState === 'logout';

    console.log('[Webhook] Estado normalizado:', {
      rawState: state,
      normalizedState,
      isConnected,
      isDisconnected,
      currentChannelStatus: channel.status,
    });

    if (isConnected) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'ACTIVE' },
      });
      console.log('[Webhook] ✅ Canal conectado:', channel.name);
      
      // Configurar webhook quando o canal é conectado (Evolution Node ou GO)
      const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
      const webhookApiKey =
        provider === 'evolution_go'
          ? channel.evolutionInstanceToken || resolveBaileysApiKey(channel)
          : resolveBaileysApiKey(channel);
      if (
        isBaileysWhatsAppChannel(channel.config as Record<string, unknown>) &&
        channel.evolutionInstanceId &&
        webhookApiKey
      ) {
        const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
        if (webhookBaseUrl) {
          const webhookPath = getBaileysWebhookPath(channel);
          const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}${webhookPath}`;
          console.log('[Webhook] 📡 Configurando webhook após conexão:', webhookUrl);
          try {
            const baileysApi = getBaileysApi(channel);
            await baileysApi.setWebhook(channel.evolutionInstanceId, webhookUrl, webhookApiKey);
            console.log('[Webhook] ✅ Webhook configurado com sucesso após conexão');
          } catch (webhookError: any) {
            console.error('[Webhook] ⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
          }
        } else {
          console.warn('[Webhook] ⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
        }
      }
      
      if (io) {
        emitChannelStatusUpdate(io, { channelId: channel.id, status: 'ACTIVE' });
        console.log('[Webhook] 📢 Evento Socket.IO emitido: channel_status_update');
      }
    } else if (isDisconnected) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'INACTIVE' },
      });
      console.log('[Webhook] ⚠️ Canal desconectado:', channel.name);
      
      if (io) {
        emitChannelStatusUpdate(io, { channelId: channel.id, status: 'INACTIVE' });
      }
    } else {
      console.log('[Webhook] ℹ️ Estado desconhecido ou não processado:', normalizedState);
    }
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro ao processar atualização de conexão:', error);
    console.error('[Webhook] Stack:', error.stack?.substring(0, 500));
  }
}

async function findChannelByEvolutionIdentifiers(
  instanceName: string | null,
  instanceUuid?: string | null,
) {
  const identifiers = [instanceUuid, instanceName].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  if (identifiers.length === 0) return null;

  for (const id of identifiers) {
    const byInstanceId = await prisma.channel.findFirst({
      where: { evolutionInstanceId: id },
    });
    if (byInstanceId) return byInstanceId;
  }

  if (instanceName) {
    const channels = await prisma.channel.findMany({
      where: { type: 'WHATSAPP' },
      select: { id: true, config: true, evolutionInstanceId: true, name: true },
    });
    const match = channels.find((ch) => {
      const cfg = (ch.config || {}) as Record<string, unknown>;
      return String(cfg.evolutionInstanceName || '') === instanceName;
    });
    if (match) {
      return prisma.channel.findUnique({ where: { id: match.id } });
    }
  }

  return null;
}

function channelProviderToWebhookSource(
  config: unknown,
): EvolutionWebhookSource {
  return getWhatsAppChannelProvider(config as Record<string, unknown>) === 'evolution_go'
    ? 'evolution_go'
    : 'evolution';
}

async function logWebhookChannelMiss(
  instanceName: string | null,
  instanceUuid: string | null | undefined,
  webhookSource: EvolutionWebhookSource,
): Promise<void> {
  const prefix = evolutionWebhookLogPrefix(webhookSource);
  const any = await findChannelByEvolutionIdentifiers(instanceName, instanceUuid);
  if (!any) {
    console.warn(
      `${prefix} Nenhum canal CRM para instância name=${instanceName || '-'} uuid=${instanceUuid || '-'}`,
    );
    return;
  }
  const provider = getWhatsAppChannelProvider(any.config as Record<string, unknown>);
  const expectedRoute =
    provider === 'evolution_go' ? '/webhooks/evolution-go' : '/webhooks/evolution';
  const appUrl = (process.env.APP_URL || process.env.NGROK_URL || 'https://SEU-CRM').replace(
    /\/$/,
    '',
  );
  console.warn(
    `${prefix} Canal "${any.name}" existe (provider=${provider}) mas não foi resolvido nesta rota (${webhookSource}). ` +
      `Use POST ${appUrl}${expectedRoute} e configure WEBHOOK_URL na ${provider === 'evolution_go' ? 'Evolution GO' : 'Evolution API'}.`,
  );
}

/** Corrige webhook na rota errada (GO vs Node) e processa com o provider do canal. */
async function processEvolutionWebhookWithRouting(
  event: any,
  routeSource: EvolutionWebhookSource,
): Promise<void> {
  const instanceName = extractEvolutionInstanceName(event);
  const instanceUuid = extractEvolutionInstanceUuid(event);
  const channel = await findChannelByEvolutionIdentifiers(instanceName, instanceUuid);

  if (channel) {
    const channelSource = channelProviderToWebhookSource(channel.config);
    if (channelSource !== routeSource) {
      const routePrefix = evolutionWebhookLogPrefix(routeSource);
      const correctPrefix = evolutionWebhookLogPrefix(channelSource);
      const wrongPath = routeSource === 'evolution_go' ? '/webhooks/evolution-go' : '/webhooks/evolution';
      const rightPath = channelSource === 'evolution_go' ? '/webhooks/evolution-go' : '/webhooks/evolution';
      console.warn(
        `${routePrefix} Webhook na rota ${wrongPath} mas a instância pertence ao canal "${channel.name}" (${channelSource}). ` +
          `${correctPrefix} Reprocessando com provider correto. Ajuste WEBHOOK_URL para ${(process.env.APP_URL || '').replace(/\/$/, '')}${rightPath}`,
      );
      await processEvolutionWebhookPayload(event, channelSource);
      return;
    }
  }

  await processEvolutionWebhookPayload(event, routeSource);
}

async function resolveChannelByEvolutionInstance(
  instanceName: string | null,
  instanceUuid?: string | null,
  webhookSource: EvolutionWebhookSource = 'evolution',
) {
  const channel = await findChannelByEvolutionIdentifiers(instanceName, instanceUuid);
  if (!channel) return null;

  const provider = getWhatsAppChannelProvider(channel.config as Record<string, unknown>);
  const expectedProvider = webhookSource === 'evolution_go' ? 'evolution_go' : 'evolution';

  if (provider !== expectedProvider) {
    console.warn(
      `${evolutionWebhookLogPrefix(webhookSource)} Canal "${channel.name}" ignorado: provider=${provider}, esperado=${expectedProvider} (instância ${instanceUuid || instanceName})`,
    );
    return null;
  }

  return channel;
}

async function resolveConversationByChannelAndPhone(
  channelId: string,
  phone: string,
  options?: { includeClosed?: boolean },
) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const contact = await contactResolutionService.findContactOnChannel(channelId, normalized);
  if (!contact) return null;

  return prisma.conversation.findFirst({
    where: {
      channelId,
      contactId: contact.id,
      ...(options?.includeClosed
        ? {}
        : { status: { in: ['OPEN', 'WAITING'] } }),
    },
    orderBy: { lastMessageAt: 'desc' },
  });
}

async function applyEvolutionMessagePatches(
  channelId: string,
  patches: ReturnType<typeof parseEvolutionMessagePatches>,
  options?: { allowContentEdit?: boolean },
): Promise<void> {
  for (const patch of patches) {
    if (!patch.externalId) continue;

    const messages = await prisma.message.findMany({
      where: { externalId: patch.externalId },
      select: { id: true, conversationId: true, content: true, metadata: true },
    });

    if (messages.length === 0) continue;

    for (const msg of messages) {
      const updateData: { status?: any; content?: string; metadata?: any } = {};

      if (patch.status) {
        updateData.status = patch.status;
      }

      if (options?.allowContentEdit && patch.content && patch.content !== msg.content) {
        updateData.content = patch.content;
        const metadata =
          msg.metadata && typeof msg.metadata === 'object' ? { ...(msg.metadata as object) } : {};
        updateData.metadata = {
          ...metadata,
          editedAt: new Date().toISOString(),
          editedVia: 'evolution',
        };
      }

      if (Object.keys(updateData).length === 0) continue;

      await prisma.message.update({
        where: { id: msg.id },
        data: updateData,
      });

      if (io) {
        if (patch.status) {
          emitMessageStatus(io, {
            conversationId: msg.conversationId,
            messageId: msg.id,
            status: patch.status,
          });
        }
        if (updateData.content) {
          emitMessageContentUpdate(io, {
            conversationId: msg.conversationId,
            messageId: msg.id,
            content: updateData.content,
          });
        }
      }
    }
  }
}

/** Evolution GO: confirmação de leitura (Receipt). */
async function handleGoReceipt(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data);
    const instanceUuid = extractEvolutionInstanceUuid(null, data);
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );
    if (!channel) return;

    const rawIds = (data as Record<string, unknown>).MessageIDs;
    const ids = Array.isArray(rawIds) ? rawIds.map((id) => String(id)).filter(Boolean) : [];
    if (ids.length === 0) return;

    const receiptType = String((data as Record<string, unknown>).Type || '').toLowerCase();
    const status = receiptType === 'read' ? 'READ' : receiptType === 'delivery' ? 'DELIVERED' : null;
    if (!status) return;

    const patches = ids.map((externalId) => ({
      externalId,
      status: status as 'READ' | 'DELIVERED',
    }));

    await applyEvolutionMessagePatches(channel.id, patches, { allowContentEdit: false });
    console.log(
      `${evolutionWebhookLogPrefix(webhookSource)} Receipt aplicado:`,
      ids.length,
      status,
    );
  } catch (error: any) {
    console.error('[Webhook] Erro em Receipt (GO):', error.message);
  }
}

async function handleMessagesUpdate(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data);
    const instanceUuid = extractEvolutionInstanceUuid(null, data);
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );
    if (!channel) {
      console.warn(
        `${evolutionWebhookLogPrefix(webhookSource)} MESSAGES_UPDATE: canal não encontrado`,
        { instanceName, instanceUuid },
      );
      return;
    }

    const patches = parseEvolutionMessagePatches(data);
    if (patches.length === 0) {
      console.log('[Webhook] MESSAGES_UPDATE sem patches reconhecíveis');
      return;
    }

    await applyEvolutionMessagePatches(channel.id, patches, { allowContentEdit: false });
    console.log('[Webhook] ✅ MESSAGES_UPDATE aplicado:', patches.length, 'patch(es)');
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro em MESSAGES_UPDATE:', error.message);
  }
}

async function handleMessagesEdited(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data);
    const instanceUuid = extractEvolutionInstanceUuid(null, data);
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );
    if (!channel) return;

    const patches = parseEvolutionMessagePatches(data);
    await applyEvolutionMessagePatches(channel.id, patches, { allowContentEdit: true });
    console.log('[Webhook] ✅ MESSAGES_EDITED aplicado:', patches.length, 'patch(es)');
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro em MESSAGES_EDITED:', error.message);
  }
}

async function handleSendMessageEvent(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data);
    const instanceUuid = extractEvolutionInstanceUuid(null, data);
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );
    if (!channel) return;

    const patches = parseEvolutionMessagePatches(data);
    const outboundPatches = patches.map((p) => ({
      ...p,
      status: p.status || ('SENT' as const),
    }));

    await applyEvolutionMessagePatches(channel.id, outboundPatches, { allowContentEdit: false });
    console.log('[Webhook] ✅ SEND_MESSAGE processado:', outboundPatches.length, 'patch(es)');
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro em SEND_MESSAGE:', error.message);
  }
}

async function handlePresenceUpdate(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data);
    const instanceUuid = extractEvolutionInstanceUuid(null, data);
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );
    if (!channel || !io) return;

    const batches = Array.isArray(data) ? data : [data];

    for (const item of batches) {
      const presence = parseEvolutionPresence(item);
      if (!presence) {
        console.log('[Webhook] PRESENCE_UPDATE ignorado (estado não reconhecido)', {
          instance: instanceName,
          keys: item && typeof item === 'object' ? Object.keys(item) : [],
        });
        continue;
      }

      let phone =
        extractPhoneFromEvolutionPresenceData(item) ||
        extractPhoneFromEvolutionJid(presence.remoteJid);

      let contact =
        phone != null
          ? await contactResolutionService.findContactOnChannel(channel.id, phone)
          : null;

      if (!contact && presence.remoteJid.includes('@lid')) {
        contact = await contactResolutionService.findContactByLidOnChannel(
          channel.id,
          presence.remoteJid,
        );
        if (contact?.phone) {
          phone = contact.phone;
        }
      }

      if (!phone || !contact) {
        console.log('[Webhook] PRESENCE_UPDATE sem telefone/contato resolvível', {
          instance: instanceName,
          remoteJid: presence.remoteJid,
          state: presence.state,
        });
        continue;
      }

      let conversation = await resolveConversationByChannelAndPhone(channel.id, phone);
      if (!conversation) {
        conversation = await resolveConversationByChannelAndPhone(channel.id, phone, {
          includeClosed: true,
        });
      }
      if (!conversation) {
        console.log('[Webhook] PRESENCE_UPDATE sem conversa para o contato', {
          instance: instanceName,
          phone,
          state: presence.state,
        });
        continue;
      }

      const uiState =
        presence.state === 'composing' || presence.state === 'recording'
          ? presence.state
          : null;

      console.log('[Webhook] PRESENCE_UPDATE → UI', {
        conversationId: conversation.id,
        phone,
        state: uiState ?? presence.state,
      });

      emitContactPresence(io, {
        conversationId: conversation.id,
        channelId: channel.id,
        state: uiState,
        contactPhone: phone,
      });
    }
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro em PRESENCE_UPDATE:', error.message);
  }
}

async function handleQRCodeUpdate(data: any) {
  try {
    const instanceName = extractEvolutionInstanceName(null, data) || data.instance;
    const instanceUuid = extractEvolutionInstanceUuid(null, data) || data.instanceId;
    const webhookSource = getWebhookSourceFromEventData(data);
    const channel = await resolveChannelByEvolutionInstance(
      instanceName,
      instanceUuid,
      webhookSource,
    );

    if (!channel) return;

    const qrcode = extractEvolutionQrBase64(data);
    if (!qrcode) {
      console.log('[Webhook] QRCODE_UPDATED sem base64 utilizável');
      return;
    }

    if (io) {
      emitQrcodeUpdate(io, { channelId: channel.id, qrcode });
    }
  } catch (error: any) {
    console.error('Erro ao processar atualização de QR Code:', error);
  }
}

// Rota alternativa para compatibilidade com URLs antigas (/api/whatsapp/webhook)
// Reutiliza o mesmo handler do webhook /evolution
router.post('/webhook', webhookReceiveLimiter, async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('📨 Webhook recebido (rota alternativa /webhook)');
    console.log('📨 Event:', event.event || event.eventName);
    
    await processEvolutionWebhookPayload(event);

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

export async function processWhatsAppOfficialWebhookPayload(payload: any): Promise<void> {
  const entries = payload?.entry || [];

  console.log(`[WhatsAppOfficial] 📦 Processando ${entries.length} entrada(s)`);

  if (entries.length === 0) {
    console.warn('[WhatsAppOfficial] ⚠️ Nenhuma entrada encontrada no webhook');
  }

  for (const entry of entries) {
    const changes = entry.changes || [];
    console.log(`[WhatsAppOfficial] 📦 Processando ${changes.length} mudança(s) na entrada`);

    for (const change of changes) {
      if (change.value) {
        const value = change.value;
        console.log('[WhatsAppOfficial] 🔍 Valor da mudança:', {
          hasMessages: !!value.messages,
          hasStatuses: !!value.statuses,
          messageCount: value.messages?.length || 0,
          statusCount: value.statuses?.length || 0,
        });

        if (value.messages && Array.isArray(value.messages)) {
          console.log(`[WhatsAppOfficial] 📩 Processando ${value.messages.length} mensagem(ns)`);
          for (const message of value.messages) {
            await handleWhatsAppOfficialMessage(message, value);
          }
        } else {
          console.log('[WhatsAppOfficial] ℹ️ Nenhuma mensagem encontrada neste evento');
        }

        if (value.statuses && Array.isArray(value.statuses)) {
          console.log(`[WhatsAppOfficial] 📊 Processando ${value.statuses.length} status`);
          for (const status of value.statuses) {
            await handleWhatsAppOfficialStatus(status);
          }
        }
      } else {
        console.warn('[WhatsAppOfficial] ⚠️ Mudança sem valor:', change);
      }
    }
  }
}

export async function processEvolutionWebhookPayload(
  event: any,
  webhookSource: EvolutionWebhookSource = 'evolution',
): Promise<void> {
  const logPrefix = evolutionWebhookLogPrefix(webhookSource);
  const eventType = extractEvolutionEventType(event);
  const instanceName = extractEvolutionInstanceName(event);
  const instanceUuid = extractEvolutionInstanceUuid(event);
  const eventData = event.data ?? event;

  attachWebhookSourceToEventData(eventData, webhookSource);

  if (instanceName && eventData && typeof eventData === 'object') {
    if (!eventData.instance) eventData.instance = instanceName;
    if (!eventData.instanceName) eventData.instanceName = instanceName;
  }
  if (instanceUuid && eventData && typeof eventData === 'object') {
    if (!eventData.instanceId) eventData.instanceId = instanceUuid;
  }

  console.log(`${logPrefix} Event Type detectado:`, eventType);
  console.log(`${logPrefix} Instance Name:`, instanceName);
  console.log(`${logPrefix} Instance UUID:`, instanceUuid);
  console.log(
    `${logPrefix} Event Data keys:`,
    eventData && typeof eventData === 'object' ? Object.keys(eventData) : [],
  );

  const normalizedEventType = eventType.toLowerCase().replace(/\./g, '_');

  if (isEvolutionHistorySyncEvent(eventType)) {
    console.log(`${logPrefix} HistorySync ignorado (histórico em massa não vira inbox)`);
    return;
  }

  if (isEvolutionIncomingMessageEvent(eventType)) {
    console.log(`${logPrefix} Processando mensagem recebida:`, eventType);
    await handleNewMessage(eventData, eventType);
    return;
  }

  if (normalizedEventType === 'receipt') {
    console.log(`${logPrefix} Processando Receipt (confirmação de leitura)`);
    await handleGoReceipt(eventData);
    return;
  }

  if (normalizedEventType.includes('messages') && normalizedEventType.includes('edited')) {
    console.log(`${logPrefix} Processando MESSAGES_EDITED`);
    await handleMessagesEdited(eventData);
    return;
  }

  if (normalizedEventType.includes('messages') && normalizedEventType.includes('update')) {
    console.log('📨 Processando como MESSAGES_UPDATE');
    await handleMessagesUpdate(eventData);
    return;
  }

  if (normalizedEventType.includes('send') && normalizedEventType.includes('message')) {
    console.log('📨 Processando como SEND_MESSAGE');
    await handleSendMessageEvent(eventData);
    return;
  }

  if (normalizedEventType.includes('presence') || normalizedEventType.includes('chatpresence')) {
    console.log(`${logPrefix} Processando presença:`, eventType);
    await handlePresenceUpdate(eventData);
    return;
  }

  if (normalizedEventType.includes('connection') && normalizedEventType.includes('update')) {
    console.log('📨 Processando como CONNECTION_UPDATE');
    await handleConnectionUpdate(eventData);
    return;
  }

  if (isEvolutionConnectionEvent(eventType)) {
    console.log('📨 Processando como evento de conexão:', eventType);
    await handleConnectionUpdate(eventData);
    return;
  }

  if (normalizedEventType.includes('qrcode')) {
    console.log('📨 Processando como QRCODE_UPDATED');
    await handleQRCodeUpdate(eventData);
    return;
  }

  console.log('📨 Tentando detectar tipo de evento automaticamente...');
  const autoBundles = extractIncomingMessageBundles(eventData, eventType);
  if (autoBundles.length > 0) {
    console.log('📨 Mensagem detectada por estrutura do payload');
    await handleNewMessage(eventData, eventType);
  } else if (eventData?.messages || event.messages || eventData?.message || event.message) {
    if (eventData?.update || (Array.isArray(eventData) && eventData[0]?.update)) {
      await handleMessagesUpdate(eventData);
    } else {
      await handleNewMessage(eventData, eventType);
    }
  } else if (eventData?.presences || eventData?.lastKnownPresence) {
    await handlePresenceUpdate(eventData);
  } else {
    console.log('⚠️ Tipo de evento não reconhecido:', eventType);
    console.log('⚠️ Estrutura do evento:', JSON.stringify(event, null, 2).substring(0, 500));
  }
}
