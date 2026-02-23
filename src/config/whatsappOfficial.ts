import { WhatsAppOfficialService } from '../services/whatsappOfficialService';

let whatsappOfficialService: WhatsAppOfficialService | null = null;

/**
 * Inicializa o serviço do WhatsApp Official
 */
export function initWhatsAppOfficial() {
  const env = process.env.WHATSAPP_ENV || 'dev';
  
  const token = env === 'dev' 
    ? process.env.WHATSAPP_DEV_TOKEN
    : process.env.WHATSAPP_TOKEN;
    
  const phoneNumberId = env === 'dev'
    ? process.env.WHATSAPP_DEV_PHONE_NUMBER_ID
    : process.env.WHATSAPP_PHONE_NUMBER_ID;
    
  const businessAccountId = env === 'dev'
    ? process.env.WHATSAPP_DEV_WABA_ID
    : process.env.WHATSAPP_WABA_ID;

  if (!token || !phoneNumberId || !businessAccountId) {
    console.warn('[WhatsAppOfficial] ⚠️ Credenciais não configuradas. WhatsApp Official não estará disponível.');
    return null;
  }

  whatsappOfficialService = new WhatsAppOfficialService({
    token,
    phoneNumberId,
    businessAccountId,
    apiVersion: 'v21.0',
  });

  console.log('[WhatsAppOfficial] ✅ Serviço inicializado:', {
    env,
    phoneNumberId,
    businessAccountId,
    hasToken: !!token,
  });

  return whatsappOfficialService;
}

/**
 * Obtém a instância do serviço do WhatsApp Official
 */
export function getWhatsAppOfficialService(): WhatsAppOfficialService | null {
  if (!whatsappOfficialService) {
    return initWhatsAppOfficial();
  }
  return whatsappOfficialService;
}

export default {
  init: initWhatsAppOfficial,
  getService: getWhatsAppOfficialService,
};

