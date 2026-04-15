import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';

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
  // Quando type === 'audio', definir true para enviar como mensagem de voz (voice message)
  voice?: boolean;
}

interface CreateTemplateParams {
  name: string;
  category: string;
  language: string;
  body: string;
}

export class WhatsAppOfficialService {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private businessAccountId: string;
  private apiVersion: string;
  private token: string;

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.apiVersion = config.apiVersion || 'v21.0';
    this.token = config.token;
    
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

      // Para áudio, permitir marcar como mensagem de voz (voice: true)
      if (params.type === 'audio' && typeof params.voice === 'boolean') {
        payload.audio = payload.audio || {};
        payload.audio.voice = params.voice;
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
   * Lista templates de mensagem cadastrados na WABA
   */
  async listTemplates(limit: number = 100, after?: string) {
    try {
      const params: any = { limit };
      if (after) {
        params.after = after;
      }

      console.log('[WhatsAppOfficial] 📋 Listando templates de mensagem...', {
        businessAccountId: this.businessAccountId,
        limit,
        after,
      });

      const response = await this.client.get(
        `/${this.businessAccountId}/message_templates`,
        { params },
      );

      return response.data;
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao listar templates:', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
          error.message ||
          'Erro ao listar templates de mensagem'
      );
    }
  }

  /**
   * Cria um template simples (apenas BODY) na WABA
   * A aprovação ainda depende da análise da Meta.
   */
  async createTemplate(params: CreateTemplateParams) {
    try {
      console.log('[WhatsAppOfficial] 📤 Criando template de mensagem...', {
        name: params.name,
        category: params.category,
        language: params.language,
      });

      const payload: any = {
        name: params.name,
        category: params.category,
        language: params.language,
        components: [
          {
            type: 'BODY',
            text: params.body,
          },
        ],
      };

      const response = await this.client.post(
        `/${this.businessAccountId}/message_templates`,
        payload,
      );

      console.log('[WhatsAppOfficial] ✅ Template criado (aguardando aprovação da Meta):', {
        id: response.data?.id,
        status: response.data?.status,
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao criar template:', {
        name: params.name,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
          error.message ||
          'Erro ao criar template de mensagem'
      );
    }
  }

  /**
   * Remove um template de mensagem (por nome + idioma)
   */
  async deleteTemplate(name: string, language: string) {
    try {
      console.log('[WhatsAppOfficial] 🗑️ Removendo template de mensagem...', {
        name,
        language,
      });

      const response = await this.client.delete(
        `/${this.businessAccountId}/message_templates`,
        {
          params: {
            name,
            language,
          },
        },
      );

      console.log('[WhatsAppOfficial] ✅ Template removido:', {
        success: response.data?.success,
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao remover template:', {
        name,
        language,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
          error.message ||
          'Erro ao remover template de mensagem'
      );
    }
  }

  /**
   * Faz upload de mídia para obter media_id
   * IMPORTANTE: Para áudio, é recomendado fazer upload primeiro para garantir formato correto
   */
  async uploadMedia(fileUrl: string, type: 'image' | 'audio' | 'video' | 'document', filename?: string) {
    try {
      console.log('[WhatsAppOfficial] 📤 Fazendo upload de mídia:', {
        fileUrl,
        type,
        filename,
      });

      const isHttpUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://');

      // Extrair nome do arquivo da URL se não fornecido
      let finalFilename = filename;
      if (!finalFilename) {
        try {
          const urlPath = new URL(fileUrl).pathname;
          finalFilename = urlPath.split('/').pop() || `file.${type === 'audio' ? 'ogg' : type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'pdf'}`;
        } catch {
          finalFilename = `file.${type === 'audio' ? 'ogg' : type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'pdf'}`;
        }
      }

      // Usar form-data para Node.js
      const formData = new FormData();
      
      // Adicionar arquivo com nome correto
      if (isHttpUrl) {
        // Baixar via HTTP (caso imagem/vídeo/documento use URL pública)
        const fileResponse = await axios.get(fileUrl, {
          responseType: 'stream',
        });

        formData.append('file', fileResponse.data, {
          filename: finalFilename,
          contentType: this.getContentType(type, finalFilename),
        });
      } else {
        // Tratar como caminho local no sistema de arquivos
        if (!fs.existsSync(fileUrl)) {
          throw new Error(`Arquivo local para upload não encontrado: ${fileUrl}`);
        }

        const fileStream = fs.createReadStream(fileUrl);
        formData.append('file', fileStream, {
          filename: finalFilename,
          contentType: this.getContentType(type, finalFilename),
        });
      }
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', type);

      console.log('[WhatsAppOfficial] 📋 Dados do upload:', {
        filename: finalFilename,
        contentType: this.getContentType(type, finalFilename),
        type,
      });

      const response = await axios.post(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      console.log('[WhatsAppOfficial] ✅ Upload concluído:', {
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
        filename,
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
   * Retorna o Content-Type apropriado baseado no tipo e nome do arquivo
   */
  private getContentType(type: 'image' | 'audio' | 'video' | 'document', filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (type === 'audio') {
      if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
      if (ext === 'mp3' || ext === 'mpeg') return 'audio/mpeg';
      if (ext === 'wav') return 'audio/wav';
      // A Cloud API oficial não documenta suporte a audio/webm, apenas ogg/mpeg/aac/amr.
      // Muitos navegadores gravam em WEBM/Opus, mas nós já convertemos para OGG no backend.
      // Portanto, mesmo que a extensão ainda seja .webm, vamos anunciar como audio/ogg.
      if (ext === 'webm') return 'audio/ogg';
      return 'audio/ogg'; // Padrão para áudio
    }
    
    if (type === 'image') {
      if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
      if (ext === 'png') return 'image/png';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
      return 'image/jpeg';
    }
    
    if (type === 'video') {
      if (ext === 'mp4') return 'video/mp4';
      if (ext === 'webm') return 'video/webm';
      return 'video/mp4';
    }
    
    return 'application/octet-stream';
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
   * Pesquisa de satisfação: lista interativa com opções de 1 a 5 estrelas.
   * Cada `rows[].id` deve ser reconhecido pelo webhook (ex.: sat:{dispatchId}:3).
   */
  async sendSatisfactionSurveyList(params: {
    to: string;
    bodyText: string;
    rows: Array<{ id: string; title: string; description: string }>;
  }) {
    try {
      const to = this.formatPhoneNumber(params.to);
      console.log('[WhatsAppOfficial] 📤 Enviando lista de satisfação:', {
        to,
        rows: params.rows.length,
      });

      const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: 'Pesquisa de satisfação' },
          body: { text: params.bodyText },
          footer: { text: 'Toque em Dar nota e escolha uma opção.' },
          action: {
            button: 'Dar nota',
            sections: [
              {
                title: 'Sua nota',
                rows: params.rows,
              },
            ],
          },
        },
      });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[WhatsAppOfficial] ❌ Erro ao enviar lista de satisfação:', {
        to: params.to,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ||
          error.message ||
          'Erro ao enviar pesquisa de satisfação via WhatsApp Official'
      );
    }
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

