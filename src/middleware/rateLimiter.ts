import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getOptionalRedisClient } from '../config/redisClient';
import { logger } from '../utils/logger';

type RateLimiterOptions = Partial<Options> &
  Pick<Options, 'windowMs' | 'max'> & {
    message: Options['message'];
  };

let redisStoreLogged = false;

/**
 * Cria rate limiter com Redis quando REDIS_URL está definido; fallback em memória.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const redis = getOptionalRedisClient();

  if (redis) {
    if (!redisStoreLogged) {
      logger.info('rate limiting using redis store', {
        prefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'rl:',
      });
      redisStoreLogged = true;
    }

    return rateLimit({
      ...options,
      store: new RedisStore({
        prefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'rl:',
        // ioredis: repassa comando Redis ao store do rate-limit-redis
        sendCommand: ((command: string, ...args: string[]) =>
          redis.call(command, ...args)) as never,
      }),
    });
  }

  return rateLimit(options);
}
