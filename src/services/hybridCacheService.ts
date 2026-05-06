import IORedis from 'ioredis';
import { TtlCache } from '../utils/ttlCache';

type RedisValueEnvelope<T> = {
  value: T;
};

export class HybridCacheService {
  private readonly memory = new TtlCache();
  private redis: IORedis | null = null;
  private redisEnabled = false;
  private redisInitTried = false;

  private ensureRedis(): IORedis | null {
    if (this.redisInitTried) return this.redis;
    this.redisInitTried = true;

    const redisUrl = process.env.REDIS_URL;
    const cacheRedisEnabled = String(process.env.CACHE_REDIS_ENABLED || 'true').toLowerCase() === 'true';
    if (!cacheRedisEnabled || !redisUrl) {
      this.redisEnabled = false;
      return null;
    }

    try {
      this.redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redisEnabled = true;
      this.redis.on('error', (error) => {
        console.error('[Cache] erro Redis:', error?.message || error);
      });
      return this.redis;
    } catch (error: any) {
      console.error('[Cache] falha ao inicializar Redis cache:', error?.message || error);
      this.redisEnabled = false;
      this.redis = null;
      return null;
    }
  }

  async getOrSet<T>(key: string, ttlMs: number, resolver: () => Promise<T>): Promise<T> {
    const memoryCached = this.memory.get<T>(key);
    if (memoryCached !== null) return memoryCached;

    const redis = this.ensureRedis();
    if (this.redisEnabled && redis) {
      try {
        if (redis.status === 'wait') {
          await redis.connect();
        }
        const raw = await redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as RedisValueEnvelope<T>;
          this.memory.set(key, parsed.value, ttlMs);
          return parsed.value;
        }
      } catch (error: any) {
        console.error('[Cache] erro ao consultar Redis:', error?.message || error);
      }
    }

    const value = await resolver();
    this.memory.set(key, value, ttlMs);

    if (this.redisEnabled && redis) {
      try {
        const payload: RedisValueEnvelope<T> = { value };
        await redis.set(key, JSON.stringify(payload), 'PX', Math.max(1000, ttlMs));
      } catch (error: any) {
        console.error('[Cache] erro ao gravar no Redis:', error?.message || error);
      }
    }

    return value;
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    if (!prefix) return;

    // Fallback local em memória
    // Estratégia simples: como o TtlCache não expõe delete por chave/prefixo,
    // não limpamos seletivamente em memória; a consistência vem do TTL curto.
    const redis = this.ensureRedis();
    if (!this.redisEnabled || !redis) return;

    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const stream = redis.scanStream({ match: `${prefix}*`, count: 200 });
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          void redis.del(...keys);
        }
      });
      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve());
        stream.on('error', (error: any) => reject(error));
      });
    } catch (error: any) {
      console.error('[Cache] erro ao invalidar prefixo Redis:', error?.message || error);
    }
  }
}

export const hybridCacheService = new HybridCacheService();

