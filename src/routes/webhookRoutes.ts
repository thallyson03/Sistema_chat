import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { WebhookService } from '../services/webhookService';
import { BotService } from '../services/botService';
import { ConversationDistributionService } from '../services/conversationDistributionService';
import { ConversationService } from '../services/conversationService';
import { SatisfactionSurveyService } from '../services/satisfactionSurveyService';
import { JourneyExecutionService } from '../services/journeyExecutionService';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const webhookService = new WebhookService();
const botService = new BotService();
const conversationService = new ConversationService();
const satisfactionSurveyService = new SatisfactionSurveyService();
const journeyExecutionService = new JourneyExecutionService();

// io será injetado via função
let io: any = null;

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

    // WhatsApp Official envia eventos em req.body.entry[]
    const entries = req.body.entry || [];
    
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

          // Processar mensagens recebidas
          if (value.messages && Array.isArray(value.messages)) {
            console.log(`[WhatsAppOfficial] 📩 Processando ${value.messages.length} mensagem(ns)`);
            for (const message of value.messages) {
              await handleWhatsAppOfficialMessage(message, value);
            }
          } else {
            console.log('[WhatsAppOfficial] ℹ️ Nenhuma mensagem encontrada neste evento');
          }

          // Processar status de mensagens (delivered, read, etc.)
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

    // Buscar ou criar contato (sempre no canal oficial resolvido). Telefone sempre normalizado (só dígitos).
    let contact = await prisma.contact.findFirst({
      where: {
        channelId: whatsappChannel.id,
        OR: [{ phone: phoneNumber }, { channelIdentifier: phoneNumber }],
      },
      include: {
        channel: true,
      },
    });

    // Se não encontrou no canal correto, tenta recuperar contato legado sem canal e re-vincular
    if (!contact) {
      const orphanContact = await prisma.contact.findFirst({
        where: {
          channelId: null,
          OR: [{ phone: phoneNumber }, { channelIdentifier: phoneNumber }],
        },
        include: { channel: true },
      });

      if (orphanContact) {
        contact = await prisma.contact.update({
          where: { id: orphanContact.id },
          data: {
            channelId: whatsappChannel.id,
            channelIdentifier: orphanContact.channelIdentifier || phoneNumber,
          },
          include: { channel: true },
        });
        console.log('[WhatsAppOfficial] 🔗 Contato órfão re-vinculado ao canal:', {
          contactId: contact.id,
          channelId: whatsappChannel.id,
        });
      } else {
        // Criar contato
        contact = await prisma.contact.create({
          data: {
            // Usar profile.name se disponível, senão fallback para número
            name: profileName || phoneNumber,
            phone: phoneNumber,
            channelId: whatsappChannel.id,
            channelIdentifier: phoneNumber, // Usar phone como identifier
          },
          include: {
            channel: true,
          },
        });
        await journeyExecutionService.processEvent('contact_created', {
          contactId: contact.id,
          channelId: contact.channelId,
        });
      }
    } else if (profileName && profileName.trim().length > 0 && contact.name !== profileName) {
      // Se o contato já existe e temos um profile.name mais "bonito",
      // atualizar o nome salvo (sem alterar telefone/canal).
      try {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: { name: profileName },
          include: { channel: true },
        });
        console.log('[WhatsAppOfficial] ✅ Nome do contato atualizado a partir do profile.name:', {
          contactId: contact.id,
          name: contact.name,
        });
      } catch (updateError: any) {
        console.warn(
          '[WhatsAppOfficial] ⚠️ Falha ao atualizar nome do contato com profile.name:',
          updateError.message,
        );
      }
    }

    // Verificar se contact foi criado/encontrado
    if (!contact) {
      console.error('[WhatsAppOfficial] ❌ Não foi possível criar/encontrar contato');
      return;
    }

    // Garantia extra: contato não pode ficar sem canal neste fluxo
    if (!contact.channelId) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { channelId: whatsappChannel.id },
        include: { channel: true },
      });
    }

    // Buscar ou criar conversa
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channelId: contact.channelId,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          channelId: contact.channelId,
          status: 'OPEN',
          lastMessageAt: timestamp,
          lastCustomerMessageAt: timestamp,
        },
      });
      await journeyExecutionService.processEvent('conversation_created', {
        contactId: contact.id,
        channelId: contact.channelId,
        conversationId: conversation.id,
      });
    } else {
      // Atualizar timestamps e reabrir conversa automaticamente com nova mensagem do cliente
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          lastMessageAt: timestamp,
          lastCustomerMessageAt: timestamp,
          unreadCount: { increment: 1 },
        },
      });
    }

    // Tentar atribuição automática sempre que a conversa estiver sem responsável.
    // Se não houver usuário disponível no setor, distributeConversation marca como WAITING (fila).
    if (!conversation.assignedToId) {
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
          channelId: contact.channelId,
        });
        if (result.handled) {
          if (io) {
            io.to(`conversation_${conversation.id}`).emit('new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            io.emit('new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            io.emit('conversation_updated');
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
          channelId: contact.channelId,
          provider: 'whatsapp_official',
        });
        if (result.handled) {
          if (io) {
            io.to(`conversation_${conversation.id}`).emit('new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            io.emit('new_message', {
              conversationId: conversation.id,
              messageId: result.messageId,
            });
            io.emit('conversation_updated');
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
    await journeyExecutionService.processEvent('message_received', {
      contactId: contact.id,
      channelId: contact.channelId,
      conversationId: conversation.id,
      messageContent,
    });

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
        // Autoativação: na primeira mensagem da conversa, se não houver humano atribuído
        // e ainda não existir sessão ativa, habilita o bot do canal/setor automaticamente.
        if (!conversation.assignedToId) {
          const currentBotSession = await prisma.botSession.findUnique({
            where: { conversationId: conversation.id },
            select: { isActive: true },
          });
          if (!currentBotSession?.isActive) {
            await conversationService.activateBotForConversation(conversation.id);
          }
        }

        await botService.processMessage(normalizedInput, conversation.id, {
          messageType,
          mediaUrl,
          mediaId,
          provider: 'whatsapp_official',
        });
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
            channelId: contact.channelId,
            content: messageContent,
            type: messageTypeDb,
            fromMe: false,
            metadata: {
              phone: contact.phone,
              contactName: contact.name,
              provider: 'whatsapp_official',
            },
          },
          contact.channelId || undefined,
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
      // Evento específico da sala da conversa (usado por outras telas/detalhes)
      io.to(`conversation_${conversation.id}`).emit('new_message', {
        conversationId: conversation.id,
        messageId: createdMessage.id,
      });

      // Evento global para lista de conversas e tela principal de conversas
      io.emit('new_message', {
        conversationId: conversation.id,
        messageId: createdMessage.id,
      });

      io.emit('conversation_updated');
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
    });

    // Atualizar status da mensagem no banco se houver externalId
    if (status.id) {
      const mappedStatus =
        status.status === 'delivered'
          ? 'DELIVERED'
          : status.status === 'read'
          ? 'READ'
          : status.status === 'failed'
          ? 'FAILED'
          : 'SENT';

      const affectedMessages = await prisma.message.findMany({
        where: {
          externalId: status.id,
        },
        select: {
          id: true,
          conversationId: true,
        },
      });

      await prisma.message.updateMany({
        where: {
          externalId: status.id,
        },
        data: {
          status: mappedStatus as any,
        },
      });

      // Emitir atualização em tempo real para refletir o check no chat sem refresh.
      if (io && affectedMessages.length > 0) {
        for (const msg of affectedMessages) {
          io.to(`conversation_${msg.conversationId}`).emit('message_status', {
            conversationId: msg.conversationId,
            messageId: msg.id,
            status: mappedStatus,
          });
          io.emit('message_status', {
            conversationId: msg.conversationId,
            messageId: msg.id,
            status: mappedStatus,
          });
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

    // Evolution API pode enviar eventos de diferentes formas
    // Verificar múltiplos formatos possíveis
    const eventType = event.event || 
                     event.eventName || 
                     event.eventType ||
                     event.data?.event ||
                     event.data?.eventName ||
                     event.data?.eventType ||
                     (event.eventName ? event.eventName : null);

    // A instância pode estar no root do evento OU dentro de data
    const instanceName = event.instance || event.data?.instance || event.instanceName || event.data?.instanceName;
    
    const eventData = event.data || event;
    
    // Adicionar instanceName ao eventData se não estiver presente
    if (instanceName && !eventData.instance && !eventData.instanceName) {
      eventData.instance = instanceName;
      eventData.instanceName = instanceName;
    }

    console.log('📨 Event Type detectado:', eventType);
    console.log('📨 Instance Name:', instanceName);
    console.log('📨 Event Data keys:', Object.keys(eventData));

    // Processar diferentes tipos de eventos
    // Evolution API pode enviar: MESSAGES_UPSERT, messages.upsert, etc.
    const normalizedEventType = (eventType || '').toLowerCase();
    
    if (normalizedEventType.includes('message') && normalizedEventType.includes('upsert')) {
      console.log('📨 Processando como MESSAGES_UPSERT');
      await handleNewMessage(eventData);
    } else if (normalizedEventType.includes('connection') && normalizedEventType.includes('update')) {
      console.log('📨 Processando como CONNECTION_UPDATE');
      await handleConnectionUpdate(eventData);
    } else if (normalizedEventType.includes('qrcode')) {
      console.log('📨 Processando como QRCODE_UPDATED');
      await handleQRCodeUpdate(eventData);
    } else {
      // Tentar processar como mensagem se tiver estrutura de mensagem
      console.log('📨 Tentando detectar tipo de evento automaticamente...');
      if (eventData.messages || event.messages || eventData.message || event.message) {
        console.log('📨 Estrutura de mensagem detectada, processando como mensagem');
        await handleNewMessage(eventData);
      } else {
        console.log('⚠️ Tipo de evento não reconhecido:', eventType);
        console.log('⚠️ Estrutura do evento:', JSON.stringify(event, null, 2).substring(0, 500));
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('❌ Erro ao processar webhook:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewMessage(data: any) {
  try {
    console.log('📩 [handleNewMessage] Processando nova mensagem...');
    console.log('📩 [handleNewMessage] Data keys:', Object.keys(data));
    console.log('📩 [handleNewMessage] Data completa:', JSON.stringify(data, null, 2).substring(0, 1000));
    
    // A Evolution API pode enviar mensagens em diferentes formatos
    // Pode ser: data.messages (array), data.message (objeto único), ou data diretamente (objeto único)
    let message: any;
    
    if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
      message = data.messages[0];
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.messages[0]');
    } else if (data.message) {
      message = data.message;
      console.log('📩 [handleNewMessage] Mensagem encontrada em data.message');
    } else if (data.key) {
      // A mensagem está diretamente em data (formato da Evolution API)
      message = data;
      console.log('📩 [handleNewMessage] Mensagem encontrada diretamente em data');
    } else {
      console.log('⚠️ [handleNewMessage] Nenhuma mensagem encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Estrutura recebida:', JSON.stringify(data, null, 2).substring(0, 500));
      return;
    }
    
    // O key pode estar em message.key OU diretamente em data.key
    // Quando message = data.message, o key está em data.key, não em message.key
    const messageKey = message.key || data.key;
    
    const rawFromMe =
      messageKey?.fromMe ??
      data.key?.fromMe ??
      (message as any).fromMe ??
      (data as any).fromMe;

    console.log('📩 [handleNewMessage] Processando mensagem:', {
      hasMessageKey: !!message.key,
      hasDataKey: !!data.key,
      hasMessageKeyFinal: !!messageKey,
      fromMe: rawFromMe,
      remoteJid: messageKey?.remoteJid || message.from || data.key?.remoteJid,
      messageId: messageKey?.id || data.key?.id,
    });
    
    // Ignorar mensagens enviadas pelo próprio sistema (fromMe)
    const fromMe =
      rawFromMe === true || rawFromMe === 'true' || rawFromMe === 1 || rawFromMe === '1';
    if (fromMe) {
      console.log('ℹ️ [handleNewMessage] Mensagem ignorada (enviada pelo sistema)');
      return;
    }

    // A instância pode estar em data.instance, data.instanceName, ou no root do evento
    const instanceName = data.instance || data.instanceName;
    if (!instanceName) {
      console.log('⚠️ [handleNewMessage] Instância não encontrada no webhook');
      console.log('⚠️ [handleNewMessage] Data keys disponíveis:', Object.keys(data));
      return;
    }
    
    console.log('📩 [handleNewMessage] Instância encontrada:', instanceName);

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) {
      console.log('Canal não encontrado para instância:', instanceName);
      return;
    }

    // Extrair número do telefone
    // O remoteJid pode estar em message.key.remoteJid, message.from, ou data.key.remoteJid
    // Quando message = data.message, o key está em data.key, não em message.key
    let remoteJid = messageKey?.remoteJid || 
                     message.from || 
                     data.key?.remoteJid ||
                     message.remoteJid;
    
    if (!remoteJid) {
      console.log('⚠️ [handleNewMessage] RemoteJid não encontrado na mensagem');
      console.log('⚠️ [handleNewMessage] Message keys:', Object.keys(message));
      console.log('⚠️ [handleNewMessage] MessageKey:', messageKey ? Object.keys(messageKey) : 'null');
      console.log('⚠️ [handleNewMessage] Data keys:', Object.keys(data));
      return;
    }

    console.log('📩 [handleNewMessage] RemoteJid encontrado:', remoteJid);
    
    // Ignorar mensagens de grupos (@g.us)
    if (remoteJid.includes('@g.us')) {
      console.log('ℹ️ [handleNewMessage] Mensagem de grupo ignorada:', remoteJid);
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
    
    // Limpar número para busca (remover caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Buscar contato por channelIdentifier (pode ter LID antigo) ou por phone
    let contact = await prisma.contact.findFirst({
      where: {
        channelId: channel.id,
        OR: [
          { channelIdentifier: cleanPhone },
          { phone: cleanPhone },
        ],
      },
    });
    
    // Se encontrou contato mas tem LID no channelIdentifier, vamos atualizar
    if (contact && contact.channelIdentifier && (contact.channelIdentifier.includes('@lid') || !/^\d+$/.test(contact.channelIdentifier))) {
      console.log('🔄 [handleNewMessage] Contato encontrado mas com LID ou identificador inválido, atualizando...');
      console.log('🔄 [handleNewMessage] Identificador antigo:', contact.channelIdentifier);
    }

    // Buscar foto de perfil do WhatsApp (usar cleanPhone)
    let profilePicture: string | null = null;
    try {
      if (channel.evolutionInstanceId && channel.evolutionApiKey && cleanPhone) {
        const { evolutionApi } = await import('../config/evolutionApi');
        const whatsappNumber = `${cleanPhone}@s.whatsapp.net`;
        profilePicture = await evolutionApi.getProfilePicture(
          channel.evolutionInstanceId,
          whatsappNumber,
          channel.evolutionApiKey
        );
        if (profilePicture) {
          console.log('📸 [handleNewMessage] Foto de perfil obtida:', profilePicture.substring(0, 100));
        }
      }
    } catch (profileError: any) {
      console.warn('⚠️ [handleNewMessage] Erro ao buscar foto de perfil:', profileError.message);
      // Continuar mesmo se falhar
    }

    if (!contact) {
      // O pushName pode estar em message.pushName ou data.pushName
      const contactName = data.pushName || message.pushName || message.notifyName || cleanPhone;
      console.log('📩 [handleNewMessage] Criando novo contato:', { name: contactName, phone: cleanPhone });
      
      if (!cleanPhone || cleanPhone.length < 10) {
        console.error('❌ [handleNewMessage] Número de telefone inválido após limpeza:', cleanPhone);
        console.error('❌ [handleNewMessage] RemoteJid original:', remoteJid);
        return;
      }
      
      contact = await prisma.contact.create({
        data: {
          channelId: channel.id,
          channelIdentifier: cleanPhone, // Usar número limpo como identificador
          name: contactName,
          phone: cleanPhone, // Salvar número limpo no campo phone também
          profilePicture: profilePicture,
          metadata: {},
        },
      });
      await journeyExecutionService.processEvent('contact_created', {
        contactId: contact.id,
        channelId: contact.channelId,
      });
      console.log('✅ [handleNewMessage] Contato criado:', contact.id);
    } else {
      // Garantir que phone é um número válido antes de atualizar
      const cleanPhone = phone.replace(/\D/g, ''); // Remove qualquer caractere não numérico
      
      // Atualizar nome, telefone e foto de perfil se mudou
      const newName = data.pushName || message.pushName || message.notifyName;
      const updateData: any = {};
      
      if (newName && newName !== contact.name) {
        updateData.name = newName;
        contact.name = newName;
        console.log('📩 [handleNewMessage] Nome do contato atualizado:', newName);
      }
      
      // Atualizar número se o contato tinha LID ou número inválido e agora temos número real
      if (cleanPhone && cleanPhone.length >= 10) {
        // Se o channelIdentifier atual contém @lid ou não é um número válido, atualizar
        const currentIdentifier = contact.channelIdentifier || '';
        const isCurrentLid = currentIdentifier.includes('@lid') || !/^\d+$/.test(currentIdentifier);
        
        if (isCurrentLid || currentIdentifier !== cleanPhone) {
          updateData.channelIdentifier = cleanPhone;
          updateData.phone = cleanPhone;
          console.log('📱 [handleNewMessage] Número de telefone atualizado (era LID ou inválido):', {
            antigo: currentIdentifier,
            novo: cleanPhone,
          });
        } else if (contact.phone !== cleanPhone) {
          // Se o channelIdentifier está correto mas o phone não, atualizar apenas o phone
          updateData.phone = cleanPhone;
          console.log('📱 [handleNewMessage] Campo phone atualizado:', cleanPhone);
        }
      }
      
      if (profilePicture && profilePicture !== contact.profilePicture) {
        updateData.profilePicture = profilePicture;
        console.log('📸 [handleNewMessage] Foto de perfil atualizada');
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: updateData,
        });
        // Atualizar objeto local para refletir mudanças
        Object.assign(contact, updateData);
      }
    }

    // Buscar canal com setor
    const channelWithSector = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        sector: true,
      },
    });

    // Buscar ou criar conversa
    let conversation: any = await prisma.conversation.findFirst({
      where: {
        channelId: channel.id,
        contactId: contact.id,
      },
      include: {
        channel: {
          include: {
            sector: true,
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          channelId: channel.id,
          contactId: contact.id,
            // Fora do pipeline, começamos no setor principal configurado no canal.
            sectorId: channelWithSector?.sectorId || null,
          status: 'OPEN',
          unreadCount: 1,
          lastMessageAt: new Date(),
          lastCustomerMessageAt: new Date(),
        } as any,
        include: {
          channel: {
            include: {
              sector: true,
            },
          },
        },
      });
      await journeyExecutionService.processEvent('conversation_created', {
        contactId: contact.id,
        channelId: channel.id,
        conversationId: conversation.id,
      });

      // Distribuir conversa automaticamente para um usuário disponível
      try {
        const distributionService = new ConversationDistributionService();
        const assignedUserId = await distributionService.distributeConversation(conversation.id, {
          channelId: channel.id,
          sectorId: channelWithSector?.sectorId || undefined,
        });

        if (assignedUserId) {
          console.log(`✅ [handleNewMessage] Conversa ${conversation.id} atribuída automaticamente ao usuário ${assignedUserId}`);
          
          // Atualizar a conversa com o usuário atribuído
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              assignedToId: assignedUserId,
            },
            include: {
              channel: {
                include: {
                  sector: true,
                },
              },
            },
          });
        } else {
          console.log(`⚠️ [handleNewMessage] Nenhum usuário disponível para atribuir a conversa ${conversation.id}`);
        }
      } catch (error: any) {
        console.error(`❌ [handleNewMessage] Erro ao distribuir conversa ${conversation.id}:`, error.message);
        // Não bloquear o processamento da mensagem se a distribuição falhar
      }
    } else {
      // Incrementar não lidas, atualizar timestamp e reabrir conversa automaticamente
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastCustomerMessageAt: new Date(),
        },
      });

      // Se a conversa não tem usuário atribuído, tentar distribuir
      if (!conversation.assignedToId) {
        try {
          const distributionService = new ConversationDistributionService();
          const assignedUserId = await distributionService.distributeConversation(conversation.id, {
            channelId: channel.id,
            sectorId: channelWithSector?.sectorId || undefined,
          });

          if (assignedUserId) {
            console.log(`✅ [handleNewMessage] Conversa ${conversation.id} atribuída automaticamente ao usuário ${assignedUserId}`);
          }
        } catch (error: any) {
          console.error(`❌ [handleNewMessage] Erro ao redistribuir conversa ${conversation.id}:`, error.message);
        }
      }
    }

    if (!conversation) {
      throw new Error('Conversa não foi possível ser carregada/criada');
    }

    // Extrair conteúdo e tipo da mensagem
    // A estrutura pode estar em message.message ou diretamente em message
    let messageContent = '';
    let messageType = 'TEXT';
    let mediaUrl: string | null = null;
    let mediaMetadata: any = null;

    // Detectar tipo e conteúdo - verificar múltiplos formatos
    const msgObj = message.message || message;
    
    if (msgObj.conversation) {
      messageContent = msgObj.conversation;
      messageType = 'TEXT';
    } else if (msgObj.extendedTextMessage?.text) {
      messageContent = msgObj.extendedTextMessage.text;
      messageType = 'TEXT';
    } else if (message.body) {
      messageContent = message.body;
      messageType = 'TEXT';
    } else if (msgObj.imageMessage) {
      messageType = 'IMAGE';
      messageContent = msgObj.imageMessage.caption || ''; // Apenas caption, sem [Imagem]
      mediaUrl = msgObj.imageMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.imageMessage.mediaKey,
        mimetype: msgObj.imageMessage.mimetype,
        fileLength: msgObj.imageMessage.fileLength,
        height: msgObj.imageMessage.height,
        width: msgObj.imageMessage.width,
      };
    } else if (msgObj.videoMessage) {
      messageType = 'VIDEO';
      messageContent = msgObj.videoMessage.caption || ''; // Apenas caption, sem [Vídeo]
      mediaUrl = msgObj.videoMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.videoMessage.mediaKey,
        mimetype: msgObj.videoMessage.mimetype,
        fileLength: msgObj.videoMessage.fileLength,
        seconds: msgObj.videoMessage.seconds,
        height: msgObj.videoMessage.height,
        width: msgObj.videoMessage.width,
      };
    } else if (msgObj.audioMessage) {
      messageType = 'AUDIO';
      messageContent = ''; // Sem texto para áudio
      mediaUrl = msgObj.audioMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.audioMessage.mediaKey,
        mimetype: msgObj.audioMessage.mimetype,
        fileLength: msgObj.audioMessage.fileLength,
        seconds: msgObj.audioMessage.seconds,
        ptt: msgObj.audioMessage.ptt,
      };
    } else if (msgObj.documentMessage) {
      messageType = 'DOCUMENT';
      messageContent = msgObj.documentMessage.fileName || ''; // Apenas nome do arquivo
      mediaUrl = msgObj.documentMessage.url;
      mediaMetadata = {
        mediaKey: msgObj.documentMessage.mediaKey,
        mimetype: msgObj.documentMessage.mimetype,
        fileLength: msgObj.documentMessage.fileLength,
        fileName: msgObj.documentMessage.fileName,
      };
    } else {
      messageContent = '[Mensagem não suportada]';
      messageType = 'TEXT';
    }

    // Verificar se mensagem já existe (evitar duplicatas)
    const messageId = messageKey?.id || data.key?.id;

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
            io.emit('new_message', {
              conversationId: conversation.id,
              channelId: channel.id,
              messageId: result.messageId,
            });
            io.emit('conversation_updated', {
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
        await journeyExecutionService.processEvent('message_received', {
          contactId: contact.id,
          channelId: channel.id,
          conversationId: conversation.id,
          messageContent,
        });
      }
      
      console.log('✅ [handleNewMessage] Mensagem criada com sucesso:', {
        messageId: createdMessage.id,
        conversationId: conversation.id,
        content: messageContent.substring(0, 50),
        type: messageType,
      });

      // Verificar se há bot ativo e processar mensagem
      if (!fromMe && messageContent) {
        try {
          // Se não existe deal (fora do pipeline) e ninguém humano está atribuído,
          // ativar automaticamente o bot do setor atual apenas quando ainda não há sessão ativa.
          const deal = conversation.id
            ? await prisma.deal.findUnique({ where: { conversationId: conversation.id } }).catch(() => null)
            : null;
          if (!deal && !conversation.assignedToId) {
            const currentBotSession = await prisma.botSession.findUnique({
              where: { conversationId: conversation.id },
              select: { isActive: true },
            });
            if (!currentBotSession?.isActive) {
              await conversationService.activateBotForConversation(conversation.id);
            }
          }

          const botResult = await botService.processMessage(messageContent, conversation.id, {
            messageType,
            provider: 'evolution',
          });
          if (botResult) {
            console.log('🤖 [handleNewMessage] Bot processou mensagem:', botResult);
            // Se o bot respondeu, não precisa emitir para n8n (ou pode emitir também)
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
          io.emit('new_message', {
            conversationId: conversation.id,
            channelId: channel.id,
            messageId: createdMessage.id,
          });
          io.emit('conversation_updated', {
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
    const instanceName = data.instance || data.instanceName;
    const state = data.state || data.status;
    
    console.log('[Webhook] 📡 Evento de conexão recebido:', {
      instanceName,
      state,
      dataKeys: Object.keys(data),
      fullData: JSON.stringify(data).substring(0, 500),
    });

    if (!instanceName) {
      console.warn('[Webhook] ⚠️ Instância não encontrada no evento de conexão');
      return;
    }

    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) {
      console.warn('[Webhook] ⚠️ Canal não encontrado para instância:', instanceName);
      return;
    }

    // Normalizar estado - Evolution API pode enviar em diferentes formatos
    const normalizedState = (state || '').toLowerCase();
    const isConnected = normalizedState === 'open' || 
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
      
      // Configurar webhook quando o canal é conectado
      if (channel.evolutionInstanceId && channel.evolutionApiKey) {
        const webhookBaseUrl = process.env.NGROK_URL || process.env.APP_URL;
        if (webhookBaseUrl) {
          const webhookUrl = `${webhookBaseUrl}/webhooks/evolution`;
          console.log('[Webhook] 📡 Configurando webhook após conexão:', webhookUrl);
          try {
            const { evolutionApi } = await import('../config/evolutionApi');
            await evolutionApi.setWebhook(channel.evolutionInstanceId, webhookUrl, channel.evolutionApiKey);
            console.log('[Webhook] ✅ Webhook configurado com sucesso após conexão');
          } catch (webhookError: any) {
            console.error('[Webhook] ⚠️ Erro ao configurar webhook após conexão:', webhookError.message);
          }
        } else {
          console.warn('[Webhook] ⚠️ NGROK_URL ou APP_URL não configurado. Webhook não será configurado.');
        }
      }
      
      // Emitir evento via Socket.IO
      if (io) {
        io.emit('channel_status_update', {
          channelId: channel.id,
          status: 'ACTIVE',
        });
        console.log('[Webhook] 📢 Evento Socket.IO emitido: channel_status_update');
      }
    } else if (isDisconnected) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { status: 'INACTIVE' },
      });
      console.log('[Webhook] ⚠️ Canal desconectado:', channel.name);
      
      // Emitir evento via Socket.IO
      if (io) {
        io.emit('channel_status_update', {
          channelId: channel.id,
          status: 'INACTIVE',
        });
      }
    } else {
      console.log('[Webhook] ℹ️ Estado desconhecido ou não processado:', normalizedState);
    }
  } catch (error: any) {
    console.error('[Webhook] ❌ Erro ao processar atualização de conexão:', error);
    console.error('[Webhook] Stack:', error.stack?.substring(0, 500));
  }
}

async function handleQRCodeUpdate(data: any) {
  try {
    const instanceName = data.instance;
    const channel = await prisma.channel.findFirst({
      where: { evolutionInstanceId: instanceName },
    });

    if (!channel) return;

    // Emitir evento via Socket.IO para atualizar QR Code
    io.emit('qrcode_update', {
      channelId: channel.id,
      qrcode: data.qrcode?.base64,
    });
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
    
    // Processar diferentes tipos de eventos (mesma lógica do /evolution)
    const eventType = event.event || event.eventName || event.data?.event;
    const eventData = event.data || event;

    if (eventType === 'messages.upsert' || event.event === 'messages.upsert') {
      await handleNewMessage(eventData);
    } else if (eventType === 'connection.update' || event.event === 'connection.update') {
      await handleConnectionUpdate(eventData);
    } else if (eventType === 'qrcode.updated' || event.event === 'qrcode.updated') {
      await handleQRCodeUpdate(eventData);
    } else {
      if (eventData.messages || event.messages) {
        await handleNewMessage(eventData);
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
