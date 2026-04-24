type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlMs),
    });
  }

  getOrSet<T>(key: string, ttlMs: number, resolver: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }
    return resolver().then((value) => {
      this.set(key, value, ttlMs);
      return value;
    });
  }
}

