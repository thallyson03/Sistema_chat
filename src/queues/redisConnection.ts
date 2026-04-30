import IORedis from 'ioredis';
import { phase1Flags } from '../config/phase1Flags';

let connection: IORedis | null = null;

export function getBullRedisConnection(): IORedis {
  if (connection) return connection;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL não configurado para uso com BullMQ.');
  }

  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (error) => {
    console.error('[BullMQ] erro de conexão Redis:', error?.message || error);
  });

  connection.on('connect', () => {
    if (phase1Flags.useBullMQ) {
      console.log('[BullMQ] conexão Redis estabelecida com sucesso.');
    }
  });

  return connection;
}

