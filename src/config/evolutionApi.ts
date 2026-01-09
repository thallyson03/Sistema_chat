import axios, { AxiosInstance } from 'axios';

class EvolutionApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getHeaders(apiKey?: string) {
    const key = apiKey || this.apiKey;
    return {
      'apikey': key,
      'Content-Type': 'application/json',
    };
  }

  async createInstance(instanceName: string, apiKey?: string, qrcode: boolean = true) {
    try {
      const response = await this.client.post(
        '/instance/create',
        {
          instanceName,
          qrcode,
          integration: 'WHATSAPP-BAILEYS',
        },
        {
          headers: this.getHeaders(apiKey),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        'Erro ao criar instância na Evolution API'
      );
    }
  }

  async getQRCode(instanceName: string, apiKey?: string) {
    try {
      const response = await this.client.get(
        `/instance/connect/${instanceName}`,
        {
          headers: this.getHeaders(apiKey),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        'Erro ao obter QR Code'
      );
    }
  }

  async getInstanceStatus(instanceName: string, apiKey?: string) {
    try {
      console.log('[EvolutionAPI] Verificando status da instância:', {
        instanceName,
        hasApiKey: !!apiKey,
        url: `${this.baseURL}/instance/fetchInstances`,
      });

      const response = await this.client.get(
        `/instance/fetchInstances`,
        {
          headers: this.getHeaders(apiKey),
        }
      );
      
      console.log('[EvolutionAPI] Resposta fetchInstances:', {
        status: response.status,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
      });

      const instances = response.data || [];
      console.log('[EvolutionAPI] Total de instâncias encontradas:', instances.length);
      
      const instance = instances.find((inst: any) => {
        const name = inst.instance?.instanceName || inst.instanceName || inst.name;
        return name === instanceName;
      });
      
      if (!instance) {
        console.warn('[EvolutionAPI] Instância não encontrada:', instanceName);
        console.log('[EvolutionAPI] Instâncias disponíveis:', instances.map((inst: any) => 
          inst.instance?.instanceName || inst.instanceName || inst.name
        ));
        return { status: 'NOT_FOUND' };
      }

      console.log('[EvolutionAPI] Instância encontrada:', {
        instanceName: instance.instance?.instanceName || instance.instanceName,
        status: instance.instance?.status || instance.instance?.state,
        hasQrcode: !!instance.qrcode,
        hasQrcodeBase64: !!instance.qrcode?.base64,
        hasToken: !!instance.instance?.token,
      });

      // A Evolution API pode retornar o QR code em diferentes formatos
      const qrcodeBase64 = instance.qrcode?.base64 || 
                          instance.qrcode || 
                          (typeof instance.qrcode === 'string' ? instance.qrcode : null);

      return {
        status: instance.instance?.status || instance.instance?.state || 'UNKNOWN',
        qrcode: qrcodeBase64,
        token: instance.instance?.token || null,
      };
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao verificar status:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? JSON.stringify(error.response.data, null, 2).substring(0, 500) : 'N/A',
        url: error.config?.url,
        method: error.config?.method,
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao verificar status da instância'
      );
    }
  }

  async sendMessage(instanceName: string, number: string, text: string, apiKey?: string) {
    try {
      const response = await this.client.post(
        `/message/sendText/${instanceName}`,
        {
          number,
          textMessage: {
            text,
          },
        },
        {
          headers: this.getHeaders(apiKey),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        'Erro ao enviar mensagem'
      );
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string, apiKey?: string) {
    try {
      const response = await this.client.post(
        `/webhook/set/${instanceName}`,
        {
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
          ],
        },
        {
          headers: this.getHeaders(apiKey),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        'Erro ao configurar webhook'
      );
    }
  }

  async deleteInstance(instanceName: string, apiKey?: string) {
    try {
      const response = await this.client.delete(
        `/instance/delete/${instanceName}`,
        {
          headers: this.getHeaders(apiKey),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        'Erro ao deletar instância'
      );
    }
  }
}

export const evolutionApi = new EvolutionApiClient();
export default evolutionApi;
