type ProviderName = 'meta' | 'evolution';

type BreakerState = {
  failures: number;
  successes: number;
  openedAt: number | null;
  halfOpen: boolean;
};

const states: Record<ProviderName, BreakerState> = {
  meta: { failures: 0, successes: 0, openedAt: null, halfOpen: false },
  evolution: { failures: 0, successes: 0, openedAt: null, halfOpen: false },
};

function now(): number {
  return Date.now();
}

function asInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isTransientError(error: any): boolean {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || '');
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET') return true;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

export class ProviderResilienceService {
  private readonly enabled = String(process.env.PROVIDER_RESILIENCE_ENABLED || 'true').toLowerCase() === 'true';
  private readonly failureThreshold = asInt(process.env.PROVIDER_BREAKER_FAILURE_THRESHOLD, 5);
  private readonly openMs = asInt(process.env.PROVIDER_BREAKER_OPEN_MS, 30_000);
  private readonly halfOpenSuccessesToClose = asInt(
    process.env.PROVIDER_BREAKER_HALF_OPEN_SUCCESS_TO_CLOSE,
    2,
  );
  private readonly maxRetries = asInt(process.env.PROVIDER_RETRY_MAX_ATTEMPTS, 3);
  private readonly retryBaseDelayMs = asInt(process.env.PROVIDER_RETRY_BASE_DELAY_MS, 400);

  isOpen(provider: ProviderName): boolean {
    if (!this.enabled) return false;
    const state = states[provider];
    if (!state.openedAt) return false;
    const stillOpen = now() - state.openedAt < this.openMs;
    if (stillOpen) return true;
    state.halfOpen = true;
    state.openedAt = null;
    state.successes = 0;
    return false;
  }

  private onSuccess(provider: ProviderName): void {
    const state = states[provider];
    if (state.halfOpen) {
      state.successes += 1;
      if (state.successes >= this.halfOpenSuccessesToClose) {
        state.halfOpen = false;
        state.failures = 0;
        state.successes = 0;
      }
      return;
    }
    state.failures = 0;
  }

  private onFailure(provider: ProviderName): void {
    const state = states[provider];
    state.failures += 1;
    if (state.failures >= this.failureThreshold) {
      state.openedAt = now();
      state.halfOpen = false;
      state.successes = 0;
    }
  }

  async execute<T>(provider: ProviderName, operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fn();

    if (this.isOpen(provider)) {
      throw new Error(`[${provider}] circuit breaker aberto para ${operation}`);
    }

    let attempt = 0;
    let lastError: any;
    while (attempt < this.maxRetries) {
      attempt += 1;
      try {
        const value = await fn();
        this.onSuccess(provider);
        return value;
      } catch (error: any) {
        lastError = error;
        const transient = isTransientError(error);
        if (!transient) {
          this.onFailure(provider);
          break;
        }
        this.onFailure(provider);
        if (attempt >= this.maxRetries) break;
        const jitter = Math.floor(Math.random() * 150);
        const delay = Math.min(4_000, this.retryBaseDelayMs * 2 ** (attempt - 1) + jitter);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

export const providerResilienceService = new ProviderResilienceService();

