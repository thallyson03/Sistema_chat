import axios, { AxiosInstance } from 'axios';
import { providerResilienceService } from '../services/providerResilienceService';

function extractApiError(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.error?.message) return String(data.error.message);
  if (data?.message) return String(data.message);
  if (data?.error && typeof data.error === 'string') return data.error;
  const status = error?.response?.status;
  const url = error?.config?.url;
  const base = error?.message || fallback;
  return status ? `${base} (HTTP ${status}${url ? ` ${url}` : ''})` : base;
}

function unwrapData<T = any>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

class EvolutionGoApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = (process.env.EVOLUTION_GO_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    this.apiKey = process.env.EVOLUTION_GO_API_KEY || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.EVOLUTION_GO_TIMEOUT_MS || process.env.EVOLUTION_TIMEOUT_MS || 12000),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private resolveGlobalApiKey(apiKey?: string): string {
    const key = apiKey || this.apiKey;
    if (!key) {
      throw new Error(
        'EVOLUTION_GO_API_KEY não configurada no CRM. Defina a variável no Coolify do backend.',
      );
    }
    return key;
  }

  private getGlobalHeaders(apiKey?: string) {
    return {
      apikey: this.resolveGlobalApiKey(apiKey),
      'Content-Type': 'application/json',
    };
  }

  /** instanceId = UUID retornado em /instance/create */
  private getInstanceHeaders(instanceUuid: string, apiKeyOrToken?: string) {
    return {
      apikey: apiKeyOrToken || this.apiKey,
      instanceId: instanceUuid,
      'Content-Type': 'application/json',
    };
  }

  private normalizeInstanceRecord(raw: any, fallbackName: string) {
    const inst = raw?.instance ?? raw;
    const instanceUuid = inst?.id ? String(inst.id) : null;
    const instanceName = String(inst?.name ?? inst?.instanceName ?? fallbackName);
    const token = inst?.token ?? raw?.token ?? null;
    const connected =
      inst?.connected === true ||
      String(inst?.connectionStatus || inst?.status || '').toLowerCase() === 'open';
    const qrcode =
      inst?.qrcode ??
      inst?.Qrcode ??
      raw?.qrcode ??
      raw?.Qrcode ??
      null;
    return { instanceUuid, instanceName, token, connected, qrcode, raw: inst };
  }

  /**
   * Cria instância na Evolution GO (body oficial: { name }).
   * Retorna UUID em instanceUuid — deve ser salvo em channel.evolutionInstanceId.
   */
  async createInstance(instanceName: string, apiKey?: string, _qrcode = true) {
    const globalKey = this.resolveGlobalApiKey(apiKey);

    console.log('[EvolutionGO] Criando instância:', {
      name: instanceName,
      baseURL: this.baseURL,
      hasApiKey: !!globalKey,
    });

    const response = await this.client.post(
      '/instance/create',
      { name: instanceName },
      { headers: this.getGlobalHeaders(globalKey) },
    );

    const data = unwrapData(response.data);
    const normalized = this.normalizeInstanceRecord(data, instanceName);

    if (!normalized.instanceUuid) {
      throw new Error(
        'Evolution GO não retornou o id (UUID) da instância. Verifique EVOLUTION_GO_API_URL e a versão da API.',
      );
    }

    console.log('[EvolutionGO] Instância criada:', {
      instanceUuid: normalized.instanceUuid,
      instanceName: normalized.instanceName,
      hasToken: !!normalized.token,
    });

    return {
      instance: {
        instanceName: normalized.instanceName,
        instanceUuid: normalized.instanceUuid,
        token: normalized.token,
      },
    };
  }

  /**
   * Conecta instância e registra webhook (documentação Evolution GO).
   */
  async connectInstance(instanceUuid: string, webhookUrl: string | null, apiKey?: string) {
    const globalKey = this.resolveGlobalApiKey(apiKey);
    const body: Record<string, unknown> = {
      subscribe: ['ALL'],
      immediate: true,
    };
    if (webhookUrl) {
      body.webhookUrl = webhookUrl;
    }

    console.log('[EvolutionGO] Conectando instância:', {
      instanceUuid,
      webhookUrl: webhookUrl || '(sem webhook)',
    });

    const response = await this.client.post('/instance/connect', body, {
      headers: {
        ...this.getGlobalHeaders(globalKey),
        instanceId: instanceUuid,
      },
    });

    return unwrapData(response.data);
  }

  async getQRCode(instanceUuid: string, apiKeyOrToken?: string) {
    const response = await this.client.get('/instance/qr', {
      headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken),
    });
    const data = unwrapData(response.data);
    const qrcode =
      data?.Qrcode ??
      data?.qrcode ??
      data?.qrCode ??
      data?.base64 ??
      (typeof data === 'string' ? data : null);
    return { qrcode, base64: qrcode, ...data };
  }

  async getInstanceStatus(instanceUuid: string, apiKey?: string) {
    const globalKey = this.resolveGlobalApiKey(apiKey);

    try {
      const response = await this.client.get('/instance/all', {
        headers: this.getGlobalHeaders(globalKey),
      });
      const data = unwrapData(response.data);
      const list = Array.isArray(data) ? data : [];

      const found = list.find((row: any) => {
        const n = this.normalizeInstanceRecord(row, '');
        return n.instanceUuid === instanceUuid || n.instanceName === instanceUuid;
      });

      if (found) {
        const n = this.normalizeInstanceRecord(found, instanceUuid);
        const status = n.connected ? 'open' : 'close';
        return {
          status,
          token: n.token,
          qrcode: n.qrcode,
        };
      }

      return { status: 'NOT_FOUND' };
    } catch (error: any) {
      throw new Error(extractApiError(error, 'Erro ao verificar status na Evolution GO'));
    }
  }

  private async postInstanceMessage(
    instanceUuid: string,
    path: string,
    payload: Record<string, unknown>,
    apiKeyOrToken?: string,
    operation = 'send',
  ) {
    const response = await providerResilienceService.execute('evolution_go', operation, async () =>
      this.client.post(path, payload, {
        headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken),
      }),
    );
    return response.data;
  }

  async sendMessage(instanceUuid: string, number: string, text: string, apiKeyOrToken?: string) {
    const cleanNumber = String(number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/text',
      { number: cleanNumber, text },
      apiKeyOrToken,
      'sendText',
    );
  }

  async sendImage(
    instanceUuid: string,
    number: string,
    imageUrl: string,
    caption?: string,
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/media',
      { number: cleanNumber, url: imageUrl, type: 'image', caption: caption || '' },
      apiKeyOrToken,
      'sendImage',
    );
  }

  async sendVideo(
    instanceUuid: string,
    number: string,
    videoUrl: string,
    caption?: string,
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/media',
      { number: cleanNumber, url: videoUrl, type: 'video', caption: caption || '' },
      apiKeyOrToken,
      'sendVideo',
    );
  }

  async sendAudio(instanceUuid: string, number: string, audioUrl: string, apiKeyOrToken?: string) {
    const cleanNumber = String(number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/media',
      { number: cleanNumber, url: audioUrl, type: 'audio' },
      apiKeyOrToken,
      'sendAudio',
    );
  }

  async sendDocument(
    instanceUuid: string,
    number: string,
    documentUrl: string,
    fileName: string,
    caption?: string,
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/media',
      {
        number: cleanNumber,
        url: documentUrl,
        type: 'document',
        filename: fileName,
        caption: caption || '',
      },
      apiKeyOrToken,
      'sendDocument',
    );
  }

  async sendButtons(
    instanceUuid: string,
    payload: {
      number: string;
      title: string;
      description: string;
      footer: string;
      buttons: Array<Record<string, unknown>>;
    },
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(payload.number).replace(/\D/g, '');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/text',
      {
        number: cleanNumber,
        text: `${payload.title}\n\n${payload.description}\n\n${payload.footer}`,
      },
      apiKeyOrToken,
      'sendButtons',
    );
  }

  async sendList(
    instanceUuid: string,
    payload: {
      number: string;
      title: string;
      description: string;
      buttonText: string;
      footerText: string;
      sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>;
      values?: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>;
    },
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(payload.number).replace(/\D/g, '');
    const lines = (payload.sections || [])
      .flatMap((section) =>
        (section.rows || []).map((row, index) => {
          const label = row.title || `Opção ${index + 1}`;
          const desc = row.description ? ` — ${row.description}` : '';
          return `${index + 1}. ${label}${desc}`;
        }),
      )
      .join('\n');
    const text = [payload.title, payload.description, lines, payload.footerText]
      .filter(Boolean)
      .join('\n\n');
    return this.postInstanceMessage(
      instanceUuid,
      '/send/text',
      { number: cleanNumber, text: text || payload.description },
      apiKeyOrToken,
      'sendList',
    );
  }

  async getProfilePicture(instanceUuid: string, number: string, apiKeyOrToken?: string) {
    try {
      const cleanNumber = String(number).replace(/\D/g, '');
      const response = await this.client.post(
        '/user/avatar',
        { number: cleanNumber },
        { headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken) },
      );
      const data = unwrapData(response.data);
      return data?.profilePictureUrl || data?.url || data?.avatar || null;
    } catch {
      return null;
    }
  }

  async sendOutboundPresence(
    instanceUuid: string,
    phone: string,
    presence: 'composing' | 'recording' | 'paused',
    apiKeyOrToken?: string,
  ) {
    const cleanNumber = String(phone).replace(/\D/g, '');
    if (cleanNumber.length < 10) return;
    try {
      await this.client.post(
        '/message/presence',
        { number: cleanNumber, presence },
        { headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken) },
      );
    } catch {
      // presença é best-effort
    }
  }

  async subscribeContactPresence(instanceUuid: string, number: string, apiKeyOrToken?: string) {
    await this.sendOutboundPresence(instanceUuid, number, 'paused', apiKeyOrToken);
  }

  async fetchWhatsAppNumberInfo(instanceUuid: string, phone: string, apiKeyOrToken?: string) {
    const cleanNumber = String(phone).replace(/\D/g, '');
    if (cleanNumber.length < 10) return null;
    try {
      const response = await this.client.post(
        '/user/check',
        { number: cleanNumber },
        { headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken) },
      );
      return unwrapData(response.data);
    } catch {
      return null;
    }
  }

  /** Na Evolution GO o webhook é configurado via POST /instance/connect */
  async setWebhook(instanceUuid: string, webhookUrl: string, globalApiKey?: string) {
    return this.connectInstance(instanceUuid, webhookUrl, globalApiKey);
  }

  async getWebhook(_instanceUuid: string, _apiKey?: string) {
    return null;
  }

  async deleteInstance(instanceUuid: string, apiKey?: string) {
    const globalKey = this.resolveGlobalApiKey(apiKey);
    try {
      const response = await this.client.delete(`/instance/delete/${encodeURIComponent(instanceUuid)}`, {
        headers: this.getGlobalHeaders(globalKey),
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw new Error(extractApiError(error, 'Erro ao deletar instância na Evolution GO'));
    }
  }

  async getBase64FromMediaMessage(
    instanceUuid: string,
    messagePayload: Record<string, any>,
    apiKeyOrToken?: string,
    convertToMp4 = false,
  ) {
    const response = await this.client.post(
      '/message/download',
      { message: messagePayload, convertToMp4 },
      {
        headers: this.getInstanceHeaders(instanceUuid, apiKeyOrToken),
        timeout: Number(
          process.env.EVOLUTION_GO_MEDIA_TIMEOUT_MS ||
            process.env.EVOLUTION_MEDIA_TIMEOUT_MS ||
            120000,
        ),
      },
    );
    const data = unwrapData(response.data);
    return {
      base64: data?.base64 ?? data?.data,
      mimetype: data?.mimetype,
    };
  }
}

export const evolutionGoApi = new EvolutionGoApiClient();
export default evolutionGoApi;
