import prisma from '../config/database';
import { ChannelStatus, ChannelType, VoiceCallDirection, VoiceCallStatus } from '@prisma/client';
import { TwilioVoiceService } from './twilioVoiceService';
import { encryptConfigSecrets, decryptConfigSecrets } from '../utils/fieldEncryption';

let io: any = null;

export function setVoiceServiceSocketIO(socketIO: any) {
  io = socketIO;
}

type PurchaseInput = {
  channelId: string;
  phoneNumber: string;
  name?: string;
  sectorId?: string;
  userId: string;
};

type OutboundCallInput = {
  channelId: string;
  to: string;
  userId: string;
  contactId?: string;
  conversationId?: string;
  dealId?: string;
};

function publicBaseUrl(): string {
  const base =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:3007';
  return base.replace(/\/$/, '');
}

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith('55')) return `+${digits}`;
  return `+${digits}`;
}

export class VoiceService {
  private twilio = new TwilioVoiceService();

  async listVoiceChannels() {
    const channels = await prisma.channel.findMany({
      where: { type: ChannelType.VOICE },
      orderBy: { createdAt: 'desc' },
      include: {
        sector: { select: { id: true, name: true } },
      },
    });
    return channels.map((ch) => this.sanitizeChannel(ch));
  }

  async createAccountChannel(input: {
    name: string;
    accountSid: string;
    authToken: string;
    apiKeySid?: string;
    apiKeySecret?: string;
    twimlAppSid?: string;
    recordingEnabled?: boolean;
    sectorId?: string;
    userId: string;
  }) {
    const channel = await prisma.channel.create({
      data: {
        name: input.name,
        type: ChannelType.VOICE,
        status: ChannelStatus.INACTIVE,
        sectorId: input.sectorId || null,
        config: encryptConfigSecrets({
          provider: 'twilio',
          accountSid: input.accountSid,
          authToken: input.authToken,
          apiKeySid: input.apiKeySid,
          apiKeySecret: input.apiKeySecret,
          twimlAppSid: input.twimlAppSid,
          recordingEnabled: Boolean(input.recordingEnabled),
        }) as object,
      },
      include: { sector: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: 'VOICE_CHANNEL_CREATED',
        resource: 'Channel',
        resourceId: channel.id,
        metadata: { provider: 'twilio', accountSid: input.accountSid.slice(0, 8) },
      },
    });

    return this.sanitizeChannel(channel);
  }

  sanitizeChannel(channel: any) {
    const config = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    return {
      ...channel,
      config: {
        provider: config.provider || 'twilio',
        accountSid: config.accountSid ? String(config.accountSid).slice(0, 8) + '…' : undefined,
        phoneNumber: config.phoneNumber || null,
        phoneNumberSid: config.phoneNumberSid || null,
        twimlAppSid: config.twimlAppSid || null,
        apiKeySid: config.apiKeySid ? '••••' : null,
        recordingEnabled: Boolean(config.recordingEnabled),
        hasAuthToken: Boolean(config.authToken),
        hasApiKeySecret: Boolean(config.apiKeySecret),
      },
    };
  }

  async getVoiceChannelOrThrow(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== ChannelType.VOICE) {
      throw new Error('Canal de voz não encontrado');
    }
    return channel;
  }

  async searchNumbers(
    channelId: string,
    query: {
      country?: string;
      areaCode?: string;
      contains?: string;
      limit?: number;
      type?: 'local' | 'mobile' | 'tollFree';
    },
  ) {
    const channel = await this.getVoiceChannelOrThrow(channelId);
    return this.twilio.searchAvailableNumbers(channel.config, query);
  }

  async purchaseNumber(input: PurchaseInput) {
    const channel = await this.getVoiceChannelOrThrow(input.channelId);
    const base = publicBaseUrl();
    const voiceUrl = `${base}/api/webhooks/voice/twilio/voice?channelId=${channel.id}`;
    const statusCallback = `${base}/api/webhooks/voice/twilio/status?channelId=${channel.id}`;

    const purchased = await this.twilio.purchaseNumber(channel.config, {
      phoneNumber: input.phoneNumber,
      voiceUrl,
      statusCallback,
      friendlyName: input.name || `CRM ${input.phoneNumber}`,
    });

    const currentConfig = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    const nextConfig = encryptConfigSecrets({
      ...currentConfig,
      provider: 'twilio',
      phoneNumber: purchased.phoneNumber,
      phoneNumberSid: purchased.phoneNumberSid,
    });

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: input.name || channel.name || purchased.friendlyName || purchased.phoneNumber,
        status: ChannelStatus.ACTIVE,
        config: nextConfig as object,
        ...(input.sectorId ? { sectorId: input.sectorId } : {}),
      },
      include: { sector: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: 'VOICE_NUMBER_PURCHASED',
        resource: 'Channel',
        resourceId: channel.id,
        metadata: {
          phoneNumber: purchased.phoneNumber,
          phoneNumberSid: purchased.phoneNumberSid,
        },
      },
    });

    return this.sanitizeChannel(updated);
  }

  async releaseNumber(channelId: string, userId: string) {
    const channel = await this.getVoiceChannelOrThrow(channelId);
    const config = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    const phoneNumberSid = String(config.phoneNumberSid || '');
    if (!phoneNumberSid) {
      throw new Error('Canal sem phoneNumberSid para liberar');
    }

    await this.twilio.releaseNumber(channel.config, phoneNumberSid);

    const nextConfig = encryptConfigSecrets({
      ...config,
      phoneNumber: null,
      phoneNumberSid: null,
    });

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        status: ChannelStatus.INACTIVE,
        config: nextConfig as object,
      },
      include: { sector: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'VOICE_NUMBER_RELEASED',
        resource: 'Channel',
        resourceId: channelId,
        metadata: { phoneNumberSid },
      },
    });

    return this.sanitizeChannel(updated);
  }

  async createClientToken(channelId: string, userId: string) {
    const channel = await this.getVoiceChannelOrThrow(channelId);
    const identity = `user_${userId}`;
    const token = this.twilio.createClientAccessToken(channel.config, identity);
    return { token, identity, channelId };
  }

  async startOutboundCall(input: OutboundCallInput) {
    const channel = await this.getVoiceChannelOrThrow(input.channelId);
    const config = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    const from = String(config.phoneNumber || '');
    if (!from) {
      throw new Error('Canal de voz sem número comprado');
    }

    const to = normalizeE164(input.to);
    const base = publicBaseUrl();
    // Liga primeiro no softphone do agente; o TwiML então disca o cliente.
    const agentClient = `client:user_${input.userId}`;
    const twimlUrl = `${base}/api/webhooks/voice/twilio/outbound-twiml?channelId=${channel.id}&to=${encodeURIComponent(to)}`;
    const statusCallback = `${base}/api/webhooks/voice/twilio/status?channelId=${channel.id}`;

    const voiceCall = await prisma.voiceCall.create({
      data: {
        channelId: channel.id,
        contactId: input.contactId || null,
        conversationId: input.conversationId || null,
        dealId: input.dealId || null,
        userId: input.userId,
        direction: VoiceCallDirection.OUTBOUND,
        status: VoiceCallStatus.QUEUED,
        fromE164: from,
        toE164: to,
        metadata: { initiatedBy: input.userId, agentClient },
      },
    });

    try {
      const result = await this.twilio.createOutboundCall(channel.config, {
        to: agentClient,
        from,
        twimlUrl,
        statusCallback,
        record: Boolean(config.recordingEnabled),
      });

      const updated = await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          providerCallId: result.callSid,
          status: this.twilio.mapTwilioStatus(result.status) as VoiceCallStatus,
        },
      });

      if (input.dealId) {
        await prisma.dealActivity.create({
          data: {
            dealId: input.dealId,
            userId: input.userId,
            type: 'CALL',
            title: `Ligação para ${to}`,
            description: 'Chamada iniciada pelo CRM',
            metadata: {
              voiceCallId: updated.id,
              providerCallId: result.callSid,
              direction: 'OUTBOUND',
            },
          },
        });
      }

      this.emitCallUpdate(updated);
      return updated;
    } catch (error: any) {
      await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          status: VoiceCallStatus.FAILED,
          endedAt: new Date(),
          metadata: {
            ...(typeof voiceCall.metadata === 'object' && voiceCall.metadata
              ? (voiceCall.metadata as object)
              : {}),
            error: error?.message || 'Falha ao iniciar chamada',
          },
        },
      });
      throw error;
    }
  }

  async listCalls(filters: {
    channelId?: string;
    contactId?: string;
    conversationId?: string;
    dealId?: string;
    limit?: number;
  }) {
    return prisma.voiceCall.findMany({
      where: {
        ...(filters.channelId ? { channelId: filters.channelId } : {}),
        ...(filters.contactId ? { contactId: filters.contactId } : {}),
        ...(filters.conversationId ? { conversationId: filters.conversationId } : {}),
        ...(filters.dealId ? { dealId: filters.dealId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(filters.limit || 50, 100),
      include: {
        channel: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  async handleInboundVoiceWebhook(channelId: string, body: Record<string, any>) {
    const channel = await this.getVoiceChannelOrThrow(channelId);
    const config = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    const from = String(body.From || '');
    const to = String(body.To || '');
    const callSid = String(body.CallSid || '');

    let contact = null;
    if (from) {
      const normalized = normalizeE164(from);
      contact = await prisma.contact.findFirst({
        where: {
          OR: [{ phone: from }, { phone: normalized }, { phone: from.replace(/\D/g, '') }],
        },
      });
    }

    let voiceCall = callSid
      ? await prisma.voiceCall.findUnique({ where: { providerCallId: callSid } })
      : null;

    if (!voiceCall) {
      voiceCall = await prisma.voiceCall.create({
        data: {
          providerCallId: callSid || null,
          channelId,
          contactId: contact?.id || null,
          direction: VoiceCallDirection.INBOUND,
          status: VoiceCallStatus.RINGING,
          fromE164: from || null,
          toE164: to || null,
          metadata: { twilio: body },
        },
      });
    }

    this.emitCallUpdate(voiceCall);

    // Sem softphone identity fixa: toca mensagem e encerra (MVP inbound).
    // Com twimlAppSid + agentes online, evoluir para dial.client(user_*)
    const response = this.twilio.buildDialClientTwiml(`user_queue_${channelId}`, {
      callerId: String(config.phoneNumber || to || ''),
    });
    return { twiml: response, voiceCall };
  }

  async handleOutboundTwiml(channelId: string, to: string) {
    const channel = await this.getVoiceChannelOrThrow(channelId);
    const config = (decryptConfigSecrets(channel.config) || {}) as Record<string, unknown>;
    const twiml = this.twilio.buildDialNumberTwiml(to, {
      callerId: String(config.phoneNumber || ''),
      record: Boolean(config.recordingEnabled),
    });
    return twiml;
  }

  async handleStatusWebhook(channelId: string, body: Record<string, any>) {
    await this.getVoiceChannelOrThrow(channelId);
    const callSid = String(body.CallSid || '');
    if (!callSid) return null;

    const status = this.twilio.mapTwilioStatus(String(body.CallStatus || '')) as VoiceCallStatus;
    const duration = body.CallDuration ? parseInt(String(body.CallDuration), 10) : undefined;
    const recordingUrl = body.RecordingUrl ? String(body.RecordingUrl) : undefined;
    const recordingSid = body.RecordingSid ? String(body.RecordingSid) : undefined;

    const existing = await prisma.voiceCall.findUnique({ where: { providerCallId: callSid } });
    const data: any = {
      status,
      ...(duration !== undefined && !Number.isNaN(duration) ? { durationSeconds: duration } : {}),
      ...(recordingUrl ? { recordingUrl } : {}),
      ...(recordingSid ? { recordingSid } : {}),
      metadata: {
        ...(typeof existing?.metadata === 'object' && existing?.metadata
          ? (existing.metadata as object)
          : {}),
        lastStatusPayload: body,
      },
    };

    if (status === 'IN_PROGRESS' && !existing?.answeredAt) {
      data.answeredAt = new Date();
    }
    if (['COMPLETED', 'BUSY', 'FAILED', 'NO_ANSWER', 'CANCELED'].includes(status)) {
      data.endedAt = new Date();
    }

    const updated = existing
      ? await prisma.voiceCall.update({ where: { id: existing.id }, data })
      : await prisma.voiceCall.create({
          data: {
            providerCallId: callSid,
            channelId,
            direction: String(body.Direction || '').includes('inbound')
              ? VoiceCallDirection.INBOUND
              : VoiceCallDirection.OUTBOUND,
            status,
            fromE164: body.From ? String(body.From) : null,
            toE164: body.To ? String(body.To) : null,
            durationSeconds: data.durationSeconds,
            recordingUrl,
            recordingSid,
            answeredAt: data.answeredAt,
            endedAt: data.endedAt,
            metadata: { lastStatusPayload: body },
          },
        });

    this.emitCallUpdate(updated);
    return updated;
  }

  validateTwilioSignature(
    channelConfig: unknown,
    signature: string | undefined,
    url: string,
    params: Record<string, any>,
  ) {
    return this.twilio.validateWebhookSignature(channelConfig, signature, url, params);
  }

  private emitCallUpdate(call: any) {
    try {
      if (!io) return;
      io.emit('voice_call_updated', call);
      if (call.userId) {
        io.to(`user_${call.userId}`).emit('voice_call_updated', call);
      }
    } catch {
      // socket opcional
    }
  }
}
