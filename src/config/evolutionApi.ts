import axios, { AxiosInstance } from 'axios';
import { providerResilienceService } from '../services/providerResilienceService';
import { resolveEvolutionWebhookSecret } from '../middleware/evolutionWebhookAuth';
import { EVOLUTION_WEBHOOK_EVENTS } from '../utils/evolutionWebhook';

class EvolutionApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: Number(process.env.EVOLUTION_TIMEOUT_MS || 12000),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getHeaders(apiKeyOrToken?: string) {
    // Se apiKeyOrToken for fornecido, usar ele (pode ser API key ou token da instância)
    // Caso contrário, usar a API key padrão
    const key = apiKeyOrToken || this.apiKey;
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

  async disconnectInstance(instanceName: string, apiKey?: string) {
    try {
      const response = await this.client.delete(`/instance/logout/${instanceName}`, {
        headers: this.getHeaders(apiKey),
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Erro ao cancelar pareamento na Evolution API',
      );
    }
  }

  async getInstanceStatus(instanceName: string, apiKey?: string, _instanceToken?: string) {
    try {
      console.log('[EvolutionAPI] Verificando status da instância:', {
        instanceName,
        hasApiKey: !!apiKey,
        url: `${this.baseURL}/instance/fetchInstances`,
      });

      // Tentar primeiro o endpoint específico da instância (se disponível)
      let response;
      let usedSpecificEndpoint = false;
      
      try {
        console.log('[EvolutionAPI] Tentando endpoint específico da instância...');
        response = await this.client.get(
          `/instance/fetchInstance/${instanceName}`,
          {
            headers: this.getHeaders(apiKey),
          }
        );
        usedSpecificEndpoint = true;
        console.log('[EvolutionAPI] ✅ Endpoint específico funcionou!');
      } catch (specificError: any) {
        // Se o endpoint específico não existir, usar fetchInstances
        console.log('[EvolutionAPI] Endpoint específico não disponível, usando fetchInstances...');
        response = await this.client.get(
          `/instance/fetchInstances`,
          {
            headers: this.getHeaders(apiKey),
          }
        );
      }
      
      console.log('[EvolutionAPI] Resposta:', {
        status: response.status,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        usedSpecificEndpoint,
      });

      // Se usou endpoint específico, a resposta pode ser um objeto único
      let instances: any[] = [];
      let instance: any;
      
      if (usedSpecificEndpoint && !Array.isArray(response.data)) {
        // Endpoint específico retorna um objeto único
        instance = response.data;
        instances = [response.data]; // Criar array para logs
        console.log('[EvolutionAPI] ✅ Resposta do endpoint específico (objeto único)');
      } else {
        // Endpoint fetchInstances retorna array
        instances = Array.isArray(response.data) ? response.data : [response.data];
        console.log('[EvolutionAPI] Total de instâncias encontradas:', instances.length);
        
        // Log completo da resposta para debug
        console.log('[EvolutionAPI] 🔍 Estrutura completa da resposta (primeiras 3 instâncias):');
        instances.slice(0, 3).forEach((inst: any, idx: number) => {
          console.log(`[EvolutionAPI] Instância ${idx + 1}:`, JSON.stringify(inst, null, 2).substring(0, 1000));
        });
        
        instance = instances.find((inst: any) => {
          const name = inst.instance?.instanceName || 
                      inst.instanceName || 
                      inst.name ||
                      inst.instance?.name;
          const found = name === instanceName;
          if (found) {
            console.log('[EvolutionAPI] ✅ Instância encontrada! Nome:', name);
          }
          return found;
        });
      }
      
      if (!instance) {
        console.warn('[EvolutionAPI] ❌ Instância não encontrada:', instanceName);
        if (instances.length > 0) {
          console.log('[EvolutionAPI] Instâncias disponíveis:', instances.map((inst: any) => {
            const name = inst.instance?.instanceName || inst.instanceName || inst.name || inst.instance?.name || 'SEM_NOME';
            const status = inst.instance?.status || inst.instance?.state || inst.status || inst.state || 'SEM_STATUS';
            return `${name} (${status})`;
          }));
        }
        return { status: 'NOT_FOUND' };
      }

      // A Evolution API pode retornar o status em diferentes campos e formatos
      // Vamos verificar TODOS os possíveis campos (connectionStatus é o mais comum)
      const rawStatus = instance.connectionStatus ||  // Campo mais comum na Evolution API v2
                       instance.instance?.connectionStatus ||
                       instance.instance?.status || 
                       instance.instance?.state || 
                       instance.status || 
                       instance.state ||
                       instance.instance?.connectionState ||
                       instance.connectionState ||
                       'UNKNOWN';
      
      // Verificar se a instância está conectada baseado em outros indicadores
      const hasToken = !!(instance.instance?.token || instance.token);
      const hasQrcode = !!(instance.qrcode?.base64 || instance.qrcode);
      
      // Se tem token e não tem QR code, provavelmente está conectada
      let inferredStatus = rawStatus;
      if (rawStatus === 'UNKNOWN' || rawStatus === '') {
        if (hasToken && !hasQrcode) {
          inferredStatus = 'open'; // Provavelmente conectada
          console.log('[EvolutionAPI] 🔍 Status inferido como "open" (tem token, sem QR code)');
        } else if (!hasToken && hasQrcode) {
          inferredStatus = 'close'; // Provavelmente desconectada (precisa conectar)
          console.log('[EvolutionAPI] 🔍 Status inferido como "close" (sem token, tem QR code)');
        } else {
          console.log('[EvolutionAPI] ⚠️ Não foi possível inferir status. Mantendo UNKNOWN.');
        }
      }
      
      console.log('[EvolutionAPI] 📊 Análise completa da instância:', {
        instanceName: instance.instance?.instanceName || instance.instanceName || instance.name,
        rawStatus,
        inferredStatus,
        hasToken,
        hasQrcode,
        statusFields: {
          'instance.status': instance.instance?.status,
          'instance.state': instance.instance?.state,
          'instance.connectionState': instance.instance?.connectionState,
          'status': instance.status,
          'state': instance.state,
          'connectionState': instance.connectionState,
        },
        tokenPresent: !!instance.instance?.token,
        qrcodePresent: !!instance.qrcode,
        fullInstanceKeys: Object.keys(instance),
        instanceStructure: JSON.stringify(instance, null, 2).substring(0, 1500), // Log mais completo
      });

      // A Evolution API pode retornar o QR code em diferentes formatos
      const qrcodeBase64 = instance.qrcode?.base64 || 
                          instance.qrcode || 
                          (typeof instance.qrcode === 'string' ? instance.qrcode : null);

      return {
        status: inferredStatus, // Usar status inferido se necessário
        qrcode: qrcodeBase64,
        token: instance.instance?.token || instance.token || null,
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

  /**
   * Botões interativos (até 3 reply, ou url/call).
   * @see https://docs.evolutionfoundation.com.br/evolution-api/send-buttons
   */
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
    try {
      console.log('[EvolutionAPI] 🔘 Enviando botões:', {
        instanceName,
        number: payload.number,
        buttonsCount: payload.buttons?.length || 0,
        endpoint: `/message/sendButtons/${instanceName}`,
      });

      const response = await providerResilienceService.execute('evolution', 'sendButtons', async () =>
        this.client.post(`/message/sendButtons/${instanceName}`, payload, {
          headers: this.getHeaders(apiKey),
        }),
      );

      console.log('[EvolutionAPI] ✅ Botões enviados:', {
        status: response.status,
        messageId: response.data?.key?.id,
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao enviar botões:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erro ao enviar botões via Evolution API',
      );
    }
  }

  /**
   * Lista interativa (menu com seções).
   * @see https://docs.evolutionfoundation.com.br/evolution-api/send-list
   */
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
    try {
      console.log('[EvolutionAPI] 📋 Enviando lista:', {
        instanceName,
        number: payload.number,
        sectionsCount: payload.sections?.length || 0,
        endpoint: `/message/sendList/${instanceName}`,
      });

      const response = await providerResilienceService.execute('evolution', 'sendList', async () =>
        this.client.post(`/message/sendList/${instanceName}`, payload, {
          headers: this.getHeaders(apiKey),
        }),
      );

      console.log('[EvolutionAPI] ✅ Lista enviada:', {
        status: response.status,
        messageId: response.data?.key?.id,
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao enviar lista:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erro ao enviar lista via Evolution API',
      );
    }
  }

  async sendMessage(instanceName: string, number: string, text: string, apiKey?: string) {
    try {
      console.log('[EvolutionAPI] 📤 Enviando mensagem:', {
        instanceName,
        number,
        textLength: text.length,
        hasApiKey: !!apiKey,
        endpoint: `/message/sendText/${instanceName}`,
      });

      // Formato correto: text diretamente no root, não dentro de textMessage
      const payload = {
        number,
        text,
      };

      console.log('[EvolutionAPI] Payload:', JSON.stringify(payload, null, 2));
      console.log('[EvolutionAPI] Headers: { apikey: "***masked***", "Content-Type": "application/json" }');

      const response = await providerResilienceService.execute('evolution', 'sendText', async () =>
        this.client.post(
          `/message/sendText/${instanceName}`,
          payload,
          {
            headers: this.getHeaders(apiKey),
          }
        )
      );

      console.log('[EvolutionAPI] ✅ Mensagem enviada com sucesso:', {
        status: response.status,
        data: JSON.stringify(response.data, null, 2).substring(0, 500),
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao enviar mensagem:', {
        instanceName,
        number,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'N/A',
        url: error.config?.url,
        method: error.config?.method,
        payload: error.config?.data ? JSON.stringify(JSON.parse(error.config.data), null, 2) : 'N/A',
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao enviar mensagem'
      );
    }
  }

  async sendImage(instanceName: string, number: string, imageUrl: string, caption?: string, apiKey?: string) {
    try {
      const payload = {
        number,
        mediatype: 'image',
        media: imageUrl,
        caption: caption || '',
      };

      return await providerResilienceService.execute('evolution', 'sendImage', async () => {
        const response = await this.client.post(
          `/message/sendMedia/${instanceName}`,
          payload,
          {
            headers: this.getHeaders(apiKey),
          }
        );
        return response.data;
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao enviar imagem'
      );
    }
  }

  async sendVideo(instanceName: string, number: string, videoUrl: string, caption?: string, apiKey?: string) {
    try {
      const payload = {
        number,
        mediatype: 'video',
        media: videoUrl,
        caption: caption || '',
      };

      return await providerResilienceService.execute('evolution', 'sendVideo', async () => {
        const response = await this.client.post(
          `/message/sendMedia/${instanceName}`,
          payload,
          {
            headers: this.getHeaders(apiKey),
          }
        );
        return response.data;
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao enviar vídeo'
      );
    }
  }

  async sendAudio(instanceName: string, number: string, audioUrl: string, apiKey?: string, mimetype?: string) {
    try {
      console.log('[EvolutionAPI] 🎵 Enviando áudio:', {
        instanceName,
        number,
        audioUrl: audioUrl.substring(0, 100),
        hasApiKey: !!apiKey,
        endpoint: `/message/sendWhatsAppAudio/${instanceName}`,
      });

      // Detectar se o conteúdo é base64 "puro" (sem http/https)
      const isBase64 = !audioUrl.startsWith('http://') && 
                       !audioUrl.startsWith('https://') &&
                       !audioUrl.startsWith('/'); // não parece ser URL/caminho

      if (!isBase64) {
        throw new Error('Áudio deve ser enviado como base64. Use o messageService para converter arquivos locais para base64 antes de chamar sendAudio.');
      }

      // Formato correto segundo a documentação: /message/sendWhatsAppAudio/{instance}
      // Payload: { "number": "...", "audio": "url or base64" }
      // Base64 pode ser enviado diretamente, sem prefixo data:
      const payload = {
        number,
        audio: audioUrl, // Base64 puro (sem prefixo data:)
      };
      
      console.log('[EvolutionAPI] 📋 Configuração de áudio:', {
        isBase64,
        base64Length: audioUrl.length,
        base64Preview: audioUrl.substring(0, 50) + '...',
      });
      
      // Log detalhado para debug (sem mostrar o base64 completo)
      console.log('[EvolutionAPI] 📋 Payload completo (sem base64):', JSON.stringify({
        number: payload.number,
        audio: `[base64: ${audioUrl.length} caracteres]`,
      }, null, 2));

      // Usar /message/sendWhatsAppAudio conforme documentação
      const response = await providerResilienceService.execute('evolution', 'sendAudio', async () =>
        this.client.post(
          `/message/sendWhatsAppAudio/${instanceName}`,
          payload,
          {
            headers: this.getHeaders(apiKey),
          }
        )
      );

      console.log('[EvolutionAPI] ✅ Áudio enviado com sucesso:', {
        status: response.status,
        data: JSON.stringify(response.data, null, 2).substring(0, 500),
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao enviar áudio:', {
        instanceName,
        number,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'N/A',
        url: error.config?.url,
        method: error.config?.method,
        payload: error.config?.data ? JSON.stringify(JSON.parse(error.config.data), null, 2) : 'N/A',
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao enviar áudio'
      );
    }
  }

  async sendDocument(instanceName: string, number: string, documentUrl: string, fileName: string, caption?: string, apiKey?: string) {
    try {
      const payload = {
        number,
        mediatype: 'document',
        media: documentUrl,
        fileName: fileName,
        caption: caption || '',
      };

      return await providerResilienceService.execute('evolution', 'sendDocument', async () => {
        const response = await this.client.post(
          `/message/sendMedia/${instanceName}`,
          payload,
          {
            headers: this.getHeaders(apiKey),
          }
        );
        return response.data;
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao enviar documento'
      );
    }
  }

  async getProfilePicture(instanceName: string, number: string, apiKey?: string) {
    try {
      console.log('[EvolutionAPI] 📸 Buscando foto de perfil:', {
        instanceName,
        number,
        hasApiKey: !!apiKey,
        endpoint: `/chat/fetchProfilePictureUrl/${instanceName}`,
      });

      const response = await this.client.get(
        `/chat/fetchProfilePictureUrl/${instanceName}`,
        {
          params: {
            number: number,
          },
          headers: this.getHeaders(apiKey),
        }
      );

      console.log('[EvolutionAPI] ✅ Foto de perfil obtida:', {
        status: response.status,
        url: response.data?.profilePictureUrl || response.data?.url || response.data,
      });

      return response.data?.profilePictureUrl || response.data?.url || response.data || null;
    } catch (error: any) {
      console.warn('[EvolutionAPI] ⚠️ Erro ao buscar foto de perfil:', {
        instanceName,
        number,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      // Não lançar erro, apenas retornar null se não conseguir obter
      return null;
    }
  }

  private buildSendPresenceBodies(
    cleanNumber: string,
    presence: 'composing' | 'recording' | 'paused',
    delayMs: number,
  ) {
    return [
      {
        number: cleanNumber,
        options: { delay: delayMs, presence, number: cleanNumber },
      },
      { number: cleanNumber, presence, delay: delayMs },
    ];
  }

  private async postSendPresence(
    instanceName: string,
    cleanNumber: string,
    presence: 'composing' | 'recording' | 'paused',
    delayMs: number,
    apiKey?: string,
  ): Promise<boolean> {
    const bodies = this.buildSendPresenceBodies(cleanNumber, presence, delayMs);
    for (const body of bodies) {
      try {
        await this.client.post(`/chat/sendPresence/${instanceName}`, body, {
          headers: this.getHeaders(apiKey),
        });
        return true;
      } catch {
        // tenta formato alternativo
      }
    }
    return false;
  }

  /**
   * Envia presença de saída para o destinatário no WhatsApp (digitando / gravando / parado).
   */
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

  /**
   * Inscreve na presença do contato (receber digitando/gravando no CRM via webhook).
   * Usa sendPresence com delay mínimo e "paused" — não exibe typing ao cliente.
   */
  async subscribeContactPresence(instanceName: string, number: string, apiKey?: string) {
    const cleanNumber = String(number).replace(/\D/g, '');
    if (cleanNumber.length < 10) return;
    await this.postSendPresence(instanceName, cleanNumber, 'paused', 1, apiKey);
  }

  /** Consulta número no WhatsApp (inclui LID quando disponível). */
  async fetchWhatsAppNumberInfo(instanceName: string, phone: string, apiKey?: string) {
    const cleanNumber = String(phone).replace(/\D/g, '');
    if (cleanNumber.length < 10) return null;

    try {
      const response = await this.client.post(
        `/chat/whatsappNumbers/${instanceName}`,
        { numbers: [cleanNumber] },
        { headers: this.getHeaders(apiKey) },
      );
      const list = Array.isArray(response.data) ? response.data : [];
      return list[0] ?? null;
    } catch {
      return null;
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string, apiKey?: string) {
    try {
      const webhookAuthSecret = resolveEvolutionWebhookSecret();

      console.log('[EvolutionAPI] 📡 Configurando webhook:', {
        instanceName,
        webhookUrl,
        hasApiKey: !!apiKey,
        hasOutgoingAuthHeader: !!webhookAuthSecret,
        endpoint: `/webhook/set/${instanceName}`,
      });

      // Formato correto conforme teste direto - a API requer "instance" e "webhook" no payload.
      // headers.apikey: a UI do Manager não expõe esse campo; o CRM valida o mesmo secret.
      const webhookConfig = {
        instance: instanceName,
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false, // Se true, cada evento vai para um sub-caminho da URL
          events: [...EVOLUTION_WEBHOOK_EVENTS],
          ...(webhookAuthSecret
            ? { headers: { apikey: webhookAuthSecret } }
            : {}),
        },
      };

      console.log('[EvolutionAPI] Configuração do webhook:', JSON.stringify({
        instance: webhookConfig.instance,
        webhook: {
          enabled: webhookConfig.webhook.enabled,
          url: webhookConfig.webhook.url,
          webhookByEvents: webhookConfig.webhook.webhookByEvents,
          events: webhookConfig.webhook.events,
          hasOutgoingAuthHeader: !!webhookAuthSecret,
        },
      }, null, 2));
      console.log('[EvolutionAPI] Endpoint completo:', `${this.baseURL}/webhook/set/${instanceName}`);
      console.log('[EvolutionAPI] Headers: { apikey: "***masked***", "Content-Type": "application/json" }');

      const response = await this.client.post(
        `/webhook/set/${instanceName}`,
        webhookConfig,
        {
          headers: this.getHeaders(apiKey),
        }
      );

      console.log('[EvolutionAPI] ✅ Webhook configurado com sucesso:', {
        status: response.status,
        data: JSON.stringify(response.data, null, 2).substring(0, 500),
      });

      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] ❌ Erro ao configurar webhook:', {
        instanceName,
        webhookUrl,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'N/A',
        url: error.config?.url,
        method: error.config?.method,
        requestData: error.config?.data ? JSON.stringify(JSON.parse(error.config.data), null, 2) : 'N/A',
        headers: error.config?.headers ? JSON.stringify(error.config.headers, null, 2) : 'N/A',
      });
      
      // Log detalhado do erro completo
      if (error.response?.data) {
        console.error('[EvolutionAPI] 📋 Detalhes completos do erro da API:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao configurar webhook'
      );
    }
  }

  async getWebhook(instanceName: string, apiKey?: string) {
    try {
      console.log('[EvolutionAPI] 🔍 Verificando webhook configurado:', {
        instanceName,
        hasApiKey: !!apiKey,
        endpoint: `/webhook/find/${instanceName}`,
      });

      const response = await this.client.get(
        `/webhook/find/${instanceName}`,
        {
          headers: this.getHeaders(apiKey),
        }
      );

      console.log('[EvolutionAPI] Webhook atual:', {
        status: response.status,
        data: JSON.stringify(response.data, null, 2).substring(0, 500),
      });

      return response.data;
    } catch (error: any) {
      // Se o endpoint não existir, retornar null (não é erro crítico)
      if (error.response?.status === 404) {
        console.log('[EvolutionAPI] ℹ️ Endpoint de verificação de webhook não disponível');
        return null;
      }
      console.error('[EvolutionAPI] ❌ Erro ao verificar webhook:', {
        instanceName,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'N/A',
      });
      throw new Error(
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message ||
        'Erro ao verificar webhook'
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

  /**
   * Obtém mídia descriptografada via Evolution (recomendado vs. baixar URL do WhatsApp no CRM).
   */
  async getBase64FromMediaMessage(
    instanceName: string,
    messagePayload: Record<string, any>,
    apiKey?: string,
    convertToMp4 = false
  ): Promise<{
    base64?: string;
    mimetype?: string;
    fileName?: string;
    mediaType?: string;
  }> {
    try {
      const response = await this.client.post(
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        {
          message: messagePayload,
          convertToMp4,
        },
        {
          headers: this.getHeaders(apiKey),
          timeout: Number(process.env.EVOLUTION_MEDIA_TIMEOUT_MS || 120000),
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erro ao obter mídia na Evolution API'
      );
    }
  }
}

export const evolutionApi = new EvolutionApiClient();
export default evolutionApi;
