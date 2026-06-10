import { getRedisClient } from '../config/redisClient';

/** Conexão Redis para BullMQ (exige REDIS_URL). */
export function getBullRedisConnection() {
  return getRedisClient();
}
