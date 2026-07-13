import twilio from 'twilio';
import { decryptConfigSecrets } from '../utils/fieldEncryption';

export type TwilioVoiceConfig = {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  twimlAppSid?: string;
  phoneNumber?: string;
  phoneNumberSid?: string;
  recordingEnabled?: boolean;
};

export type AvailableNumberResult = {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

function asConfig(raw: unknown): TwilioVoiceConfig {
  const decrypted = decryptConfigSecrets(raw) as Record<string, unknown>;
  const accountSid = String(decrypted.accountSid || '').trim();
  const authToken = String(decrypted.authToken || '').trim();
  if (!accountSid || !authToken) {
    throw new Error('Canal de voz Twilio sem accountSid/authToken configurados');
  }
  return {
    provider: 'twilio',
    accountSid,
    authToken,
    apiKeySid: decrypted.apiKeySid ? String(decrypted.apiKeySid) : undefined,
    apiKeySecret: decrypted.apiKeySecret ? String(decrypted.apiKeySecret) : undefined,
    twimlAppSid: decrypted.twimlAppSid ? String(decrypted.twimlAppSid) : undefined,
    phoneNumber: decrypted.phoneNumber ? String(decrypted.phoneNumber) : undefined,
    phoneNumberSid: decrypted.phoneNumberSid ? String(decrypted.phoneNumberSid) : undefined,
    recordingEnabled: Boolean(decrypted.recordingEnabled),
  };
}

export class TwilioVoiceService {
  getClient(configRaw: unknown) {
    const config = asConfig(configRaw);
    return {
      config,
      client: twilio(config.accountSid, config.authToken),
    };
  }

  async searchAvailableNumbers(
    configRaw: unknown,
    params: {
      country?: string;
      areaCode?: string;
      contains?: string;
      limit?: number;
      type?: 'local' | 'mobile' | 'tollFree';
    },
  ): Promise<AvailableNumberResult[]> {
    const { client } = this.getClient(configRaw);
    const country = (params.country || 'BR').toUpperCase();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const type = params.type || 'local';

    const listParams: Record<string, string | number | boolean> = {
      voiceEnabled: true,
      limit,
    };
    if (params.areaCode) listParams.areaCode = params.areaCode;
    if (params.contains) listParams.contains = params.contains;

    let list: Array<{
      phoneNumber: string;
      friendlyName: string;
      locality?: string;
      region?: string;
      isoCountry: string;
      capabilities: { voice: boolean; sms: boolean; mms: boolean };
    }> = [];

    if (type === 'mobile') {
      list = await client.availablePhoneNumbers(country).mobile.list(listParams as any);
    } else if (type === 'tollFree') {
      list = await client.availablePhoneNumbers(country).tollFree.list(listParams as any);
    } else {
      list = await client.availablePhoneNumbers(country).local.list(listParams as any);
    }

    return list.map((item) => ({
      phoneNumber: item.phoneNumber,
      friendlyName: item.friendlyName,
      locality: item.locality,
      region: item.region,
      isoCountry: item.isoCountry,
      capabilities: {
        voice: Boolean(item.capabilities?.voice),
        sms: Boolean(item.capabilities?.sms),
        mms: Boolean(item.capabilities?.mms),
      },
    }));
  }

  async purchaseNumber(
    configRaw: unknown,
    params: {
      phoneNumber: string;
      voiceUrl: string;
      statusCallback: string;
      friendlyName?: string;
    },
  ) {
    const { client, config } = this.getClient(configRaw);
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: params.phoneNumber,
      friendlyName: params.friendlyName || `CRM ${params.phoneNumber}`,
      voiceUrl: params.voiceUrl,
      voiceMethod: 'POST',
      statusCallback: params.statusCallback,
      statusCallbackMethod: 'POST',
    });

    return {
      phoneNumber: purchased.phoneNumber,
      phoneNumberSid: purchased.sid,
      friendlyName: purchased.friendlyName,
      accountSid: config.accountSid,
    };
  }

  async releaseNumber(configRaw: unknown, phoneNumberSid: string) {
    const { client } = this.getClient(configRaw);
    await client.incomingPhoneNumbers(phoneNumberSid).remove();
  }

  async updateNumberWebhooks(
    configRaw: unknown,
    phoneNumberSid: string,
    urls: { voiceUrl: string; statusCallback: string },
  ) {
    const { client } = this.getClient(configRaw);
    await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: urls.voiceUrl,
      voiceMethod: 'POST',
      statusCallback: urls.statusCallback,
      statusCallbackMethod: 'POST',
    });
  }

  /**
   * Token para softphone no browser (Twilio Voice JS SDK).
   * Requer apiKeySid, apiKeySecret e twimlAppSid no config do canal.
   */
  createClientAccessToken(configRaw: unknown, identity: string, ttlSeconds = 3600): string {
    const config = asConfig(configRaw);
    if (!config.apiKeySid || !config.apiKeySecret || !config.twimlAppSid) {
      throw new Error(
        'Softphone requer apiKeySid, apiKeySecret e twimlAppSid no canal Twilio',
      );
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const token = new AccessToken(config.accountSid, config.apiKeySid, config.apiKeySecret, {
      identity,
      ttl: ttlSeconds,
    });
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: config.twimlAppSid,
        incomingAllow: true,
      }),
    );
    return token.toJwt();
  }

  async createOutboundCall(
    configRaw: unknown,
    params: {
      to: string;
      from: string;
      twimlUrl: string;
      statusCallback: string;
      record?: boolean;
    },
  ) {
    const { client, config } = this.getClient(configRaw);
    const call = await client.calls.create({
      to: params.to,
      from: params.from,
      url: params.twimlUrl,
      method: 'POST',
      statusCallback: params.statusCallback,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: params.record ?? config.recordingEnabled ?? false,
    });
    return {
      callSid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
    };
  }

  validateWebhookSignature(
    configRaw: unknown,
    signature: string | undefined,
    url: string,
    params: Record<string, any>,
  ): boolean {
    if (process.env.ALLOW_INSECURE_WEBHOOKS === 'true' && process.env.NODE_ENV !== 'production') {
      return true;
    }
    if (!signature) return false;
    const config = asConfig(configRaw);
    return twilio.validateRequest(config.authToken, signature, url, params);
  }

  mapTwilioStatus(status: string): string {
    const normalized = String(status || '').toLowerCase();
    switch (normalized) {
      case 'queued':
        return 'QUEUED';
      case 'ringing':
        return 'RINGING';
      case 'in-progress':
        return 'IN_PROGRESS';
      case 'completed':
        return 'COMPLETED';
      case 'busy':
        return 'BUSY';
      case 'failed':
        return 'FAILED';
      case 'no-answer':
        return 'NO_ANSWER';
      case 'canceled':
      case 'cancelled':
        return 'CANCELED';
      default:
        return 'QUEUED';
    }
  }

  buildConnectAgentTwiml(options?: { say?: string }): string {
    const response = new twilio.twiml.VoiceResponse();
    if (options?.say) {
      response.say({ language: 'pt-BR' }, options.say);
    }
    return response.toString();
  }

  buildDialNumberTwiml(toNumber: string, options?: { callerId?: string; record?: boolean }): string {
    const response = new twilio.twiml.VoiceResponse();
    const dial = response.dial({
      callerId: options?.callerId,
      record: options?.record ? 'record-from-answer-dual' : undefined,
      answerOnBridge: true,
    });
    dial.number(toNumber);
    return response.toString();
  }

  buildDialClientTwiml(clientIdentity: string, options?: { callerId?: string }): string {
    const response = new twilio.twiml.VoiceResponse();
    const dial = response.dial({
      callerId: options?.callerId,
      answerOnBridge: true,
    });
    dial.client(clientIdentity);
    return response.toString();
  }
}
