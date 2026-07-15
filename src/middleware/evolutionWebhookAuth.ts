import { Request, Response, NextFunction } from 'express';
import { timingSafeEqualText } from '../utils/securityHelpers';

function allowInsecureWebhooks(): boolean {
  const flag = String(process.env.ALLOW_INSECURE_WEBHOOKS || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/** Segredo que o CRM exige no header do webhook (mesma ordem do middleware). */
export function resolveEvolutionWebhookSecret(): string {
  return (
    process.env.EVOLUTION_WEBHOOK_SECRET ||
    process.env.EVOLUTION_API_KEY ||
    process.env.EVOLUTION_GO_API_KEY ||
    ''
  ).trim();
}

export function validateEvolutionWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = resolveEvolutionWebhookSecret();

  if (!secret) {
    if (allowInsecureWebhooks()) {
      return next();
    }
    return res.status(503).json({
      error: 'Webhook Evolution não configurado (EVOLUTION_WEBHOOK_SECRET)',
    });
  }

  const provided =
    String(req.headers['apikey'] || '').trim() ||
    String(req.headers['x-api-key'] || '').trim() ||
    (typeof req.headers['authorization'] === 'string' &&
    req.headers['authorization'].startsWith('Bearer ')
      ? req.headers['authorization'].slice('Bearer '.length).trim()
      : '');

  if (!provided || !timingSafeEqualText(provided, secret)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  return next();
}
