import IORedis from 'ioredis';
import { logger } from '../utils/logger';

let sharedClient: IORedis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/**
 * Cliente Redis compartilhado (rate limit, BullMQ). Retorna null se REDIS_URL ausente.
 */
export function getOptionalRedisClient(): IORedis | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  if (!sharedClient) {
    sharedClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    sharedClient.on('error', (error) => {
      logger.error('redis connection error', {
        message: error?.message || String(error),
      });
    });

    sharedClient.on('connect', () => {
      logger.info('redis connection established');
    });
  }

  return sharedClient;
}

/** Exige REDIS_URL — usado por filas BullMQ. */
export function getRedisClient(): IORedis {
  const client = getOptionalRedisClient();
  if (!client) {
    throw new Error('REDIS_URL não configurado.');
  }
  return client;
}
