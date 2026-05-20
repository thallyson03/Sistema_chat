import axios, { AxiosInstance } from 'axios';
import { providerResilienceService } from '../services/providerResilienceService';
import { EVOLUTION_WEBHOOK_EVENTS } from '../utils/evolutionWebhook';

function extractApiError(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.error?.message) return String(data.error.message);
  if (data?.message) return String(data.message);
  if (data?.error && typeof data.error === 'string') return data.error;
  return error?.message || fallback;
}

function unwrapData<T = any>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

class EvolutionGoApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_GO_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_GO_API_KEY || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.EVOLUTION_GO_TIMEOUT_MS || process.env.EVOLUTION_TIMEOUT_MS || 12000),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private getHeaders(apiKeyOrToken?: string) {
    return {
      apikey: apiKeyOrToken || this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private normalizeInstanceRecord(raw: any, fallbackName: string) {
    const inst = raw?.instance ?? raw;
    const instanceName =
      inst?.instanceName ?? inst?.name ?? inst?.id ?? fallbackName;
    const token = inst?.token ?? raw?.token ?? null;
    const connected =
      inst?.connected === true ||
      String(inst?.connectionStatus || inst?.status || '').toLowerCase() === 'open';
    return { instanceName: String(instanceName), token, connected, raw: inst };
  }

  async createInstance(instanceName: string, apiKey?: string, _qrcode = true) {
    const bodies = [
      { instanceName, integration: 'WHATSAPP-BAILEYS' },
      { name: instanceName },
      { instanceName, name: instanceName },
    ];

    let lastError: any;
    for (const body of bodies) {
      try {
        const response = await this.client.post('/instance/create', body, {
          headers: this.getHeaders(apiKey),
        });
        const normalized = this.normalizeInstanceRecord(unwrapData(response.data), instanceName);
        return {
          instance: {
            instanceName: normalized.instanceName,
            token: normalized.token,
          },
        };
      } catch (error: any) {
        lastError = error;
      }
    }

    throw new Error(extractApiError(lastError, 'Erro ao criar instância na Evolution GO'));
  }

  async getQRCode(instanceName: string, apiKey?: string) {
    const paths = [
      `/instance/${encodeURIComponent(instanceName)}/qrcode`,
      `/instance/connect/${encodeURIComponent(instanceName)}`,
    ];

    let lastError: any;
    for (const path of paths) {
      try {
        const response = await this.client.get(path, { headers: this.getHeaders(apiKey) });
        const data = unwrapData(response.data);
        const qrcode =
          data?.qrcode?.base64 ??
          data?.qrcode ??
          data?.base64 ??
          (typeof data?.qrcode === 'string' ? data.qrcode : null);
        return { qrcode, base64: qrcode, ...data };
      } catch (error: any) {
        lastError = error;
      }
    }

    throw new Error(extractApiError(lastError, 'Erro ao obter QR Code na Evolution GO'));
  }

  async getInstanceStatus(instanceName: string, apiKey?: string) {
    const listPaths = ['/instance/get-all-instances', '/instance/fetchInstances'];

    try {
      for (const path of listPaths) {
        try {
          const response = await this.client.get(path, { headers: this.getHeaders(apiKey) });
          const data = unwrapData(response.data);
          const list = Array.isArray(data) ? data : Array.isArray(data?.instances) ? data.instances : [data];
          const found = list.find((row: any) => {
            const n = this.normalizeInstanceRecord(row, '');
            return n.instanceName === instanceName;
          });
          if (found) {
            const n = this.normalizeInstanceRecord(found, instanceName);
            const status = n.connected ? 'open' : 'close';
            return { status, token: n.token, qrcode: found?.qrcode?.base64 ?? found?.qrcode ?? null };
          }
        } catch {
          // tenta próximo path
        }
      }

      return { status: 'NOT_FOUND' };
    } catch (error: any) {
      throw new Error(extractApiError(error, 'Erro ao verificar status na Evolution GO'));
    }
  }

  async sendMessage(instanceName: string, number: string, text: string, apiKey?: string) {
    const payload = { number, text };
    const response = await providerResilienceService.execute('evolution_go', 'sendText', async () =>
      this.client.post(`/message/sendText/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendImage(instanceName: string, number: string, imageUrl: string, caption?: string, apiKey?: string) {
    const payload = { number, mediatype: 'image', media: imageUrl, caption: caption || '' };
    const response = await providerResilienceService.execute('evolution_go', 'sendImage', async () =>
      this.client.post(`/message/sendMedia/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendVideo(instanceName: string, number: string, videoUrl: string, caption?: string, apiKey?: string) {
    const payload = { number, mediatype: 'video', media: videoUrl, caption: caption || '' };
    const response = await providerResilienceService.execute('evolution_go', 'sendVideo', async () =>
      this.client.post(`/message/sendMedia/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendAudio(instanceName: string, number: string, audioUrl: string, apiKey?: string) {
    const payload = { number, audio: audioUrl };
    const response = await providerResilienceService.execute('evolution_go', 'sendAudio', async () =>
      this.client.post(`/message/sendWhatsAppAudio/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendDocument(
    instanceName: string,
    number: string,
    documentUrl: string,
    fileName: string,
    caption?: string,
    apiKey?: string,
  ) {
    const payload = {
      number,
      mediatype: 'document',
      media: documentUrl,
      fileName,
      caption: caption || '',
    };
    const response = await providerResilienceService.execute('evolution_go', 'sendDocument', async () =>
      this.client.post(`/message/sendMedia/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendButtons(
    instanceName: string,
    payload: {
      number: string;
      title: string;
      description: string;
      footer: string;
      buttons: Array<Record<string, unknown>>;
    },
    apiKey?: string,
  ) {
    const response = await providerResilienceService.execute('evolution_go', 'sendButtons', async () =>
      this.client.post(`/message/sendButtons/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async sendList(
    instanceName: string,
    payload: {
      number: string;
      title: string;
      description: string;
      buttonText: string;
      footerText: string;
      sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>;
      values?: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>;
    },
    apiKey?: string,
  ) {
    const response = await providerResilienceService.execute('evolution_go', 'sendList', async () =>
      this.client.post(`/message/sendList/${instanceName}`, payload, {
        headers: this.getHeaders(apiKey),
      }),
    );
    return response.data;
  }

  async getProfilePicture(instanceName: string, number: string, apiKey?: string) {
    try {
      const response = await this.client.get(
        `/chat/fetchProfilePictureUrl/${instanceName}`,
        { params: { number }, headers: this.getHeaders(apiKey) },
      );
      const data = unwrapData(response.data);
      return data?.profilePictureUrl || data?.url || data || null;
    } catch {
      return null;
    }
  }

  private buildSendPresenceBodies(
    cleanNumber: string,
    presence: 'composing' | 'recording' | 'paused',
    delayMs: number,
  ) {
    return [
      { number: cleanNumber, options: { delay: delayMs, presence, number: cleanNumber } },
      { number: cleanNumber, presence, delay: delayMs },
    ];
  }

  private async postSendPresence(
    instanceName: string,
    cleanNumber: string,
    presence: 'composing' | 'recording' | 'paused',
    delayMs: number,
    apiKey?: string,
  ) {
    const bodies = this.buildSendPresenceBodies(cleanNumber, presence, delayMs);
    for (const body of bodies) {
      try {
        await this.client.post(`/chat/sendPresence/${instanceName}`, body, {
          headers: this.getHeaders(apiKey),
        });
        return;
      } catch {
        // formato alternativo
      }
    }
  }

  async sendOutboundPresence(
    instanceName: string,
    phone: string,
    presence: 'composing' | 'recording' | 'paused',
    apiKey?: string,
  ) {
    const cleanNumber = String(phone).replace(/\D/g, '');
    if (cleanNumber.length < 10) return;
    const delayMs = presence === 'paused' ? 1 : 20_000;
    await this.postSendPresence(instanceName, cleanNumber, presence, delayMs, apiKey);
  }

  async subscribeContactPresence(instanceName: string, number: string, apiKey?: string) {
    const cleanNumber = String(number).replace(/\D/g, '');
    if (cleanNumber.length < 10) return;
    await this.postSendPresence(instanceName, cleanNumber, 'paused', 1, apiKey);
  }

  async fetchWhatsAppNumberInfo(instanceName: string, phone: string, apiKey?: string) {
    const cleanNumber = String(phone).replace(/\D/g, '');
    if (cleanNumber.length < 10) return null;
    try {
      const response = await this.client.post(
        `/chat/whatsappNumbers/${instanceName}`,
        { numbers: [cleanNumber] },
        { headers: this.getHeaders(apiKey) },
      );
      const data = unwrapData(response.data);
      const list = Array.isArray(data) ? data : [];
      return list[0] ?? null;
    } catch {
      return null;
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string, apiKey?: string) {
    const webhookConfig = {
      instance: instanceName,
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [...EVOLUTION_WEBHOOK_EVENTS],
      },
    };

    const paths = [
      `/webhook/set/${instanceName}`,
      `/instance/${encodeURIComponent(instanceName)}/webhook`,
    ];

    let lastError: any;
    for (const path of paths) {
      try {
        const response = await this.client.post(path, webhookConfig, {
          headers: this.getHeaders(apiKey),
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    throw new Error(extractApiError(lastError, 'Erro ao configurar webhook na Evolution GO'));
  }

  async getWebhook(instanceName: string, apiKey?: string) {
    try {
      const response = await this.client.get(`/webhook/find/${instanceName}`, {
        headers: this.getHeaders(apiKey),
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw new Error(extractApiError(error, 'Erro ao verificar webhook na Evolution GO'));
    }
  }

  async deleteInstance(instanceName: string, apiKey?: string) {
    const paths = [
      `/instance/delete/${encodeURIComponent(instanceName)}`,
      `/instance/${encodeURIComponent(instanceName)}`,
    ];

    let lastError: any;
    for (const path of paths) {
      try {
        const response = await this.client.delete(path, { headers: this.getHeaders(apiKey) });
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 404) return null;
      }
    }

    throw new Error(extractApiError(lastError, 'Erro ao deletar instância na Evolution GO'));
  }

  async getBase64FromMediaMessage(
    instanceName: string,
    messagePayload: Record<string, any>,
    apiKey?: string,
    convertToMp4 = false,
  ) {
    const response = await this.client.post(
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      { message: messagePayload, convertToMp4 },
      {
        headers: this.getHeaders(apiKey),
        timeout: Number(process.env.EVOLUTION_GO_MEDIA_TIMEOUT_MS || process.env.EVOLUTION_MEDIA_TIMEOUT_MS || 120000),
      },
    );
    return unwrapData(response.data);
  }
}

export const evolutionGoApi = new EvolutionGoApiClient();
export default evolutionGoApi;
