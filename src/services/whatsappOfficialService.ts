import axios, { AxiosInstance } from 'axios';

interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion?: string;
}

interface SendTextMessageParams {
  to: string; // Número no formato internacional (ex: 5511999999999)
  text: string;
}

interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  language: string;
  components?: any[];
}

interface SendMediaMessageParams {
  to: string;
  mediaUrl?: string;
  mediaId?: string;
  type: 'image' | 'audio' | 'video' | 'document';
  caption?: string;
  filename?: string;
}

export class WhatsAppOfficialService {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private businessAccountId: string;
  private apiVersion: string;

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.apiVersion = config.apiVersion || 'v21.0';
    
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(params: SendTextMessageParams) {
    try {
      console.log('[WhatsAppOfficial] 📤 Enviando mensagem de texto:', {
        to: params.to,
        textLength: params.text.length,
      });

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(params.to),
          type: 'text',
          text: {
            preview_url: false,
            body: params.text,
          },
        }
      );

      console.log('[WhatsAppOfficial] ✅ Mensagem enviada:', {
        messageId: response.data.messages?.[0]?.id,
        status: response.status,
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao enviar mensagem:', {
        to: params.to,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
        error.message ||
        'Erro ao enviar mensagem via WhatsApp Official'
      );
    }
  }

  /**
   * Envia mensagem de template (para mensagens fora da janela de 24h)
   */
  async sendTemplateMessage(params: SendTemplateMessageParams) {
    try {
      console.log('[WhatsAppOfficial] 📤 Enviando template:', {
        to: params.to,
        templateName: params.templateName,
        language: params.language,
      });

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(params.to),
        type: 'template',
        template: {
          name: params.templateName,
          language: {
            code: params.language,
          },
        },
      };

      if (params.components && params.components.length > 0) {
        payload.template.components = params.components;
      }

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      console.log('[WhatsAppOfficial] ✅ Template enviado:', {
        messageId: response.data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao enviar template:', {
        to: params.to,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
        error.message ||
        'Erro ao enviar template via WhatsApp Official'
      );
    }
  }

  /**
   * Envia mídia (imagem, áudio, vídeo, documento)
   */
  async sendMediaMessage(params: SendMediaMessageParams) {
    try {
      console.log('[WhatsAppOfficial] 📤 Enviando mídia:', {
        to: params.to,
        type: params.type,
        hasMediaUrl: !!params.mediaUrl,
        hasMediaId: !!params.mediaId,
      });

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(params.to),
        type: params.type,
      };

      if (params.mediaId) {
        // Usar media_id se já foi feito upload
        payload[params.type] = {
          id: params.mediaId,
        };
      } else if (params.mediaUrl) {
        // Usar URL direta
        payload[params.type] = {
          link: params.mediaUrl,
        };
      } else {
        throw new Error('mediaUrl ou mediaId é obrigatório');
      }

      // Adicionar caption se fornecido
      if (params.caption && (params.type === 'image' || params.type === 'video')) {
        payload[params.type].caption = params.caption;
      }

      // Adicionar filename para documentos
      if (params.filename && params.type === 'document') {
        payload[params.type].filename = params.filename;
      }

      const response = await this.client.post(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      console.log('[WhatsAppOfficial] ✅ Mídia enviada:', {
        messageId: response.data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao enviar mídia:', {
        to: params.to,
        type: params.type,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
        error.message ||
        'Erro ao enviar mídia via WhatsApp Official'
      );
    }
  }

  /**
   * Faz upload de mídia para obter media_id
   * Nota: Para usar este método, você precisa fazer upload do arquivo primeiro
   * e depois usar o media_id retornado. Por enquanto, usamos URLs diretas.
   */
  async uploadMedia(fileUrl: string, type: 'image' | 'audio' | 'video' | 'document') {
    try {
      console.log('[WhatsAppOfficial] 📤 Fazendo upload de mídia:', {
        fileUrl,
        type,
      });

      // Para Node.js, precisamos usar form-data ou fazer upload direto
      // Por enquanto, vamos usar a URL direta (mais simples)
      // Se precisar fazer upload real, use a biblioteca 'form-data'
      
      // Primeiro, baixar o arquivo
      const fileResponse = await axios.get(fileUrl, {
        responseType: 'stream',
      });

      // Usar form-data para Node.js
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('file', fileResponse.data);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', type);

      const response = await axios.post(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.client.defaults.headers['Authorization']}`,
            ...formData.getHeaders(),
          },
        }
      );

      console.log('[WhatsAppOfficial] ✅ Mídia enviada:', {
        mediaId: response.data.id,
      });

      return {
        mediaId: response.data.id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao fazer upload de mídia:', {
        fileUrl,
        type,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
        error.message ||
        'Erro ao fazer upload de mídia'
      );
    }
  }

  /**
   * Formata número de telefone para formato internacional (sem + e espaços)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove caracteres não numéricos
    let formatted = phone.replace(/\D/g, '');
    
    // Se não começar com código do país, assumir Brasil (55)
    if (!formatted.startsWith('55') && formatted.length <= 11) {
      formatted = '55' + formatted;
    }
    
    return formatted;
  }

  /**
   * Verifica status de uma mensagem
   */
  async getMessageStatus(messageId: string) {
    try {
      const response = await this.client.get(`/${messageId}`);
      return response.data;
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao verificar status:', error);
      throw error;
    }
  }
}

