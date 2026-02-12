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

  async getInstanceStatus(instanceName: string, apiKey?: string) {
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
      console.log('[EvolutionAPI] Headers:', JSON.stringify(this.getHeaders(apiKey), null, 2));

      const response = await this.client.post(
        `/message/sendText/${instanceName}`,
        payload,
        {
          headers: this.getHeaders(apiKey),
        }
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

      const response = await this.client.post(
        `/message/sendMedia/${instanceName}`,
        payload,
        {
          headers: this.getHeaders(apiKey),
        }
      );

      return response.data;
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

      const response = await this.client.post(
        `/message/sendMedia/${instanceName}`,
        payload,
        {
          headers: this.getHeaders(apiKey),
        }
      );

      return response.data;
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
      const response = await this.client.post(
        `/message/sendWhatsAppAudio/${instanceName}`,
        payload,
        {
          headers: this.getHeaders(apiKey),
        }
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

      const response = await this.client.post(
        `/message/sendMedia/${instanceName}`,
        payload,
        {
          headers: this.getHeaders(apiKey),
        }
      );

      return response.data;
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

  async setWebhook(instanceName: string, webhookUrl: string, apiKey?: string) {
    try {
      console.log('[EvolutionAPI] 📡 Configurando webhook:', {
        instanceName,
        webhookUrl,
        hasApiKey: !!apiKey,
        endpoint: `/webhook/set/${instanceName}`,
      });

      // Formato correto conforme teste direto - a API requer "instance" e "webhook" no payload
      const webhookConfig = {
        instance: instanceName,
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false, // Se true, cada evento vai para um sub-caminho da URL
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
          ],
        },
      };

      console.log('[EvolutionAPI] Configuração do webhook:', JSON.stringify(webhookConfig, null, 2));
      console.log('[EvolutionAPI] Endpoint completo:', `${this.baseURL}/webhook/set/${instanceName}`);
      console.log('[EvolutionAPI] Headers:', JSON.stringify(this.getHeaders(apiKey), null, 2));

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
}

export const evolutionApi = new EvolutionApiClient();
export default evolutionApi;
