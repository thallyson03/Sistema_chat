import { logger } from '../utils/logger';

const WEAK_JWT_SECRETS = new Set([
  'troque-em-producao',
  'change-me',
  'secret',
  'jwt-secret',
]);

function isStrictMode(): boolean {
  const raw = String(process.env.SECURITY_STRICT_MODE || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function validateProductionSecurity(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = isStrictMode();

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret) {
    errors.push('JWT_SECRET é obrigatório em produção');
  } else if (jwtSecret.length < 16) {
    errors.push('JWT_SECRET deve ter pelo menos 16 caracteres em produção');
  } else if (jwtSecret.length < 32) {
    warnings.push(
      'JWT_SECRET tem menos de 32 caracteres — recomendado aumentar para maior segurança',
    );
  } else if (WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase())) {
    errors.push('JWT_SECRET padrão não é permitido em produção');
  }

  if (!process.env.MEDIA_SIGNED_URL_SECRET && !jwtSecret) {
    errors.push('MEDIA_SIGNED_URL_SECRET ou JWT_SECRET é obrigatório para URLs de mídia');
  }

  const channelEncryptionKey = (process.env.CHANNEL_SECRETS_ENCRYPTION_KEY || '').trim();
  if (!channelEncryptionKey) {
    errors.push(
      'CHANNEL_SECRETS_ENCRYPTION_KEY é obrigatório em produção para criptografar segredos de canais',
    );
  } else if (!/^[0-9a-fA-F]{64}$/.test(channelEncryptionKey) && channelEncryptionKey.length < 16) {
    errors.push(
      'CHANNEL_SECRETS_ENCRYPTION_KEY deve ter 64 caracteres hex ou passphrase com pelo menos 16 caracteres',
    );
  }

  if (!process.env.METRICS_AUTH_TOKEN) {
    const msg = 'METRICS_AUTH_TOKEN não configurado — /metrics ficará desabilitado';
    if (strict) errors.push(msg);
    else warnings.push(msg);
  }

  if (!process.env.EVOLUTION_WEBHOOK_SECRET && !process.env.EVOLUTION_API_KEY) {
    const msg =
      'EVOLUTION_WEBHOOK_SECRET ou EVOLUTION_API_KEY não configurado — webhooks Evolution rejeitarão requisições';
    if (strict) errors.push(msg);
    else warnings.push(msg);
  }

  if (
    !process.env.PUBLIC_PIPELINE_API_KEY &&
    !process.env.PUBLIC_PIPELINE_SIGNATURE_SECRET
  ) {
    warnings.push(
      'PUBLIC_PIPELINE_API_KEY não configurado — API pública de pipeline permanece desabilitada (comportamento seguro)',
    );
  }

  for (const warn of warnings) {
    logger.warn('production security recommendation', { reason: warn });
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error('production security validation failed', { reason: err });
    }
    throw new Error(
      `Configuração de segurança inválida para produção:\n- ${errors.join('\n- ')}`,
    );
  }

  logger.info('production security validation passed', {
    strictMode: strict,
    warnings: warnings.length,
  });
}
