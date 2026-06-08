import { logger } from '../utils/logger';

const WEAK_JWT_SECRETS = new Set([
  'troque-em-producao',
  'change-me',
  'secret',
  'jwt-secret',
]);

export function validateProductionSecurity(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres em produção');
  } else if (WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
    errors.push('JWT_SECRET padrão não é permitido em produção');
  }

  if (!process.env.METRICS_AUTH_TOKEN) {
    errors.push('METRICS_AUTH_TOKEN é obrigatório em produção');
  }

  if (!process.env.EVOLUTION_WEBHOOK_SECRET && !process.env.EVOLUTION_API_KEY) {
    errors.push('EVOLUTION_WEBHOOK_SECRET ou EVOLUTION_API_KEY é obrigatório em produção');
  }

  if (!process.env.WHATSAPP_APP_SECRET) {
    errors.push('WHATSAPP_APP_SECRET é obrigatório em produção');
  }

  if (
    !process.env.PUBLIC_PIPELINE_API_KEY &&
    !process.env.PUBLIC_PIPELINE_SIGNATURE_SECRET
  ) {
    errors.push(
      'PUBLIC_PIPELINE_API_KEY ou PUBLIC_PIPELINE_SIGNATURE_SECRET é obrigatório em produção',
    );
  }

  if (!process.env.MEDIA_SIGNED_URL_SECRET && !process.env.JWT_SECRET) {
    errors.push('MEDIA_SIGNED_URL_SECRET ou JWT_SECRET é obrigatório para URLs de mídia');
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error('production security validation failed', { reason: err });
    }
    throw new Error(
      `Configuração de segurança inválida para produção:\n- ${errors.join('\n- ')}`,
    );
  }

  logger.info('production security validation passed');
}
