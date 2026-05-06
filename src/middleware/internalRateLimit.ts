import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

function asInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function requestIdentity(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      return `token:${crypto.createHash('sha1').update(token).digest('hex')}`;
    }
  }
  return req.ip || 'unknown-ip';
}

const defaultWindowMs = asInt(process.env.INTERNAL_RATE_LIMIT_WINDOW_MS, 60_000);

export const internalApiLimiter = rateLimit({
  keyGenerator: requestIdentity,
  standardHeaders: true,
  legacyHeaders: false,
  windowMs: defaultWindowMs,
  max: asInt(process.env.INTERNAL_RATE_LIMIT_MAX, 300),
  message: {
    error: 'Muitas requisições internas em sequência. Aguarde alguns segundos e tente novamente.',
  },
  skip: (req) => req.path === '/health',
});

export const internalHeavyReadLimiter = rateLimit({
  keyGenerator: requestIdentity,
  standardHeaders: true,
  legacyHeaders: false,
  windowMs: defaultWindowMs,
  max: asInt(process.env.INTERNAL_HEAVY_READ_RATE_LIMIT_MAX, 120),
  message: {
    error: 'Limite de consultas intensivas atingido. Tente novamente em instantes.',
  },
  skip: (req) => req.method !== 'GET',
});

