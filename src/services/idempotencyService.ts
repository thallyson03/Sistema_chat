type Entry = {
  expiresAt: number;
};

class IdempotencyService {
  private readonly keys = new Map<string, Entry>();

  private cleanup(now: number): void {
    for (const [key, entry] of this.keys.entries()) {
      if (entry.expiresAt <= now) this.keys.delete(key);
    }
  }

  register(key: string, ttlMs: number): boolean {
    const now = Date.now();
    this.cleanup(now);

    const existing = this.keys.get(key);
    if (existing && existing.expiresAt > now) return false;

    this.keys.set(key, { expiresAt: now + Math.max(1_000, ttlMs) });
    return true;
  }
}

export const idempotencyService = new IdempotencyService();

