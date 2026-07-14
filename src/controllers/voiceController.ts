import { Request, Response } from 'express';
import { VoiceService } from '../services/voiceService';
import { AuthRequest } from '../middleware/auth';

const voiceService = new VoiceService();

export class VoiceController {
  async listChannels(req: AuthRequest, res: Response) {
    try {
      const channels = await voiceService.listVoiceChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar canais de voz' });
    }
  }

  async createAccountChannel(req: AuthRequest, res: Response) {
    try {
      const {
        name,
        accountSid,
        authToken,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        addressSid,
        bundleSid,
        recordingEnabled,
        sectorId,
      } = req.body || {};

      if (!name || !accountSid || !authToken) {
        return res.status(400).json({
          error: 'name, accountSid e authToken são obrigatórios',
        });
      }

      const channel = await voiceService.createAccountChannel({
        name: String(name).trim(),
        accountSid: String(accountSid).trim(),
        authToken: String(authToken).trim(),
        apiKeySid: apiKeySid ? String(apiKeySid).trim() : undefined,
        apiKeySecret: apiKeySecret ? String(apiKeySecret).trim() : undefined,
        twimlAppSid: twimlAppSid ? String(twimlAppSid).trim() : undefined,
        addressSid: addressSid ? String(addressSid).trim() : undefined,
        bundleSid: bundleSid ? String(bundleSid).trim() : undefined,
        recordingEnabled: Boolean(recordingEnabled),
        sectorId: sectorId || undefined,
        userId: req.user!.id,
      });

      res.status(201).json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao criar canal de voz' });
    }
  }

  async updateAccountChannel(req: AuthRequest, res: Response) {
    try {
      const {
        name,
        accountSid,
        authToken,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        addressSid,
        bundleSid,
        recordingEnabled,
        sectorId,
      } = req.body || {};

      const channel = await voiceService.updateAccountChannel(req.params.channelId, {
        name: name !== undefined ? String(name) : undefined,
        accountSid: accountSid !== undefined ? String(accountSid) : undefined,
        authToken: authToken !== undefined ? String(authToken) : undefined,
        apiKeySid: apiKeySid !== undefined ? String(apiKeySid) : undefined,
        apiKeySecret: apiKeySecret !== undefined ? String(apiKeySecret) : undefined,
        twimlAppSid: twimlAppSid !== undefined ? String(twimlAppSid) : undefined,
        addressSid: addressSid !== undefined ? String(addressSid) : undefined,
        bundleSid: bundleSid !== undefined ? String(bundleSid) : undefined,
        recordingEnabled:
          recordingEnabled !== undefined ? Boolean(recordingEnabled) : undefined,
        sectorId: sectorId !== undefined ? sectorId || null : undefined,
        userId: req.user!.id,
      });

      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao atualizar canal de voz' });
    }
  }

  async searchNumbers(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params;
      const numbers = await voiceService.searchNumbers(channelId, {
        country: req.query.country ? String(req.query.country) : 'BR',
        areaCode: req.query.areaCode ? String(req.query.areaCode) : undefined,
        contains: req.query.contains ? String(req.query.contains) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 20,
        type: (req.query.type as 'local' | 'mobile' | 'tollFree') || 'local',
      });
      res.json({ numbers });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao buscar números' });
    }
  }

  async purchaseNumber(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params;
      const { phoneNumber, name, sectorId } = req.body || {};
      if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber é obrigatório' });
      }
      const channel = await voiceService.purchaseNumber({
        channelId,
        phoneNumber: String(phoneNumber),
        name,
        sectorId,
        userId: req.user!.id,
      });
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao comprar número' });
    }
  }

  async releaseNumber(req: AuthRequest, res: Response) {
    try {
      const channel = await voiceService.releaseNumber(req.params.channelId, req.user!.id);
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao liberar número' });
    }
  }

  async createToken(req: AuthRequest, res: Response) {
    try {
      const result = await voiceService.createClientToken(req.params.channelId, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao gerar token' });
    }
  }

  async startCall(req: AuthRequest, res: Response) {
    try {
      const { channelId, to, contactId, conversationId, dealId } = req.body || {};
      if (!channelId || !to) {
        return res.status(400).json({ error: 'channelId e to são obrigatórios' });
      }
      const call = await voiceService.startOutboundCall({
        channelId: String(channelId),
        to: String(to),
        userId: req.user!.id,
        contactId,
        conversationId,
        dealId,
      });
      res.status(201).json(call);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Erro ao iniciar chamada' });
    }
  }

  async listCalls(req: AuthRequest, res: Response) {
    try {
      const calls = await voiceService.listCalls({
        channelId: req.query.channelId ? String(req.query.channelId) : undefined,
        contactId: req.query.contactId ? String(req.query.contactId) : undefined,
        conversationId: req.query.conversationId
          ? String(req.query.conversationId)
          : undefined,
        dealId: req.query.dealId ? String(req.query.dealId) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 50,
      });
      res.json(calls);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar chamadas' });
    }
  }

  // --- Webhooks Twilio (sem JWT) ---

  private async resolveChannelForWebhook(req: Request) {
    const channelId = String(req.query.channelId || req.body?.channelId || '');
    if (!channelId) throw new Error('channelId obrigatório no webhook');
    return voiceService.getVoiceChannelOrThrow(channelId);
  }

  private buildWebhookUrl(req: Request): string {
    const base =
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`;
    return `${base.replace(/\/$/, '')}${req.originalUrl.split('?')[0]}?${new URLSearchParams(
      req.query as Record<string, string>,
    ).toString()}`.replace(/\?$/, '');
  }

  async twilioVoiceWebhook(req: Request, res: Response) {
    try {
      const channel = await this.resolveChannelForWebhook(req);
      const signature = req.header('X-Twilio-Signature') || undefined;
      const url = this.buildWebhookUrl(req);
      const valid = voiceService.validateTwilioSignature(
        channel.config,
        signature,
        url,
        req.body || {},
      );
      if (!valid) {
        return res.status(403).type('text/plain').send('Invalid signature');
      }

      const { twiml } = await voiceService.handleInboundVoiceWebhook(channel.id, req.body || {});
      res.type('text/xml').send(twiml);
    } catch (error: any) {
      console.error('[VoiceWebhook] voice error:', error.message);
      res
        .type('text/xml')
        .send('<Response><Say language="pt-BR">Não foi possível atender a chamada.</Say></Response>');
    }
  }

  async twilioOutboundTwiml(req: Request, res: Response) {
    try {
      const channel = await this.resolveChannelForWebhook(req);
      const to = String(req.query.to || req.body?.to || '');
      if (!to) {
        return res
          .type('text/xml')
          .send('<Response><Say language="pt-BR">Destino inválido.</Say></Response>');
      }
      const signature = req.header('X-Twilio-Signature') || undefined;
      const url = this.buildWebhookUrl(req);
      const valid = voiceService.validateTwilioSignature(
        channel.config,
        signature,
        url,
        req.body || {},
      );
      if (!valid) {
        return res.status(403).type('text/plain').send('Invalid signature');
      }
      const twiml = await voiceService.handleOutboundTwiml(channel.id, to);
      res.type('text/xml').send(twiml);
    } catch (error: any) {
      console.error('[VoiceWebhook] outbound twiml error:', error.message);
      res
        .type('text/xml')
        .send('<Response><Say language="pt-BR">Falha na ligação.</Say></Response>');
    }
  }

  async twilioStatusWebhook(req: Request, res: Response) {
    try {
      const channel = await this.resolveChannelForWebhook(req);
      const signature = req.header('X-Twilio-Signature') || undefined;
      const url = this.buildWebhookUrl(req);
      const valid = voiceService.validateTwilioSignature(
        channel.config,
        signature,
        url,
        req.body || {},
      );
      if (!valid) {
        return res.status(403).type('text/plain').send('Invalid signature');
      }
      await voiceService.handleStatusWebhook(channel.id, req.body || {});
      res.status(200).send('OK');
    } catch (error: any) {
      console.error('[VoiceWebhook] status error:', error.message);
      res.status(200).send('OK');
    }
  }
}
