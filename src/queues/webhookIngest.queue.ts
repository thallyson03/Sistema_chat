import { JobsOptions, Queue, Worker } from 'bullmq';
import { phase1Flags } from '../config/phase1Flags';
import { getBullRedisConnection } from './redisConnection';

type WebhookProvider = 'whatsapp_official' | 'evolution';

type WebhookIngestJob = {
  provider: WebhookProvider;
  payload: any;
  dedupeKey: string;
  attempt: number;
};

type WebhookHandlers = {
  processWhatsAppOfficial: (payload: any) => Promise<void>;
  processEvolution: (payload: any) => Promise<void>;
};

class WebhookIngestQueue {
  private readonly jobs: WebhookIngestJob[] = [];
  private handlers: WebhookHandlers | null = null;
  private processing = false;
  private readonly maxAttempts = 5;
  private readonly queueName = 'webhook-ingest';
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private bullReady = false;

  private initializeBullIfNeeded(): void {
    if (!phase1Flags.useBullMQ || this.bullReady) return;

    const connection = getBullRedisConnection();
    this.queue = new Queue(this.queueName, { connection });
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        if (!this.handlers) {
          console.warn('[WebhookIngestQueue] handlers não registrados, descartando job BullMQ.');
          return;
        }
        const data = job.data as Omit<WebhookIngestJob, 'attempt'>;
        if (data.provider === 'whatsapp_official') {
          await this.handlers.processWhatsAppOfficial(data.payload);
        } else {
          await this.handlers.processEvolution(data.payload);
        }
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      console.error('[WebhookIngestQueue] BullMQ job falhou:', {
        jobId: job?.id,
        dedupeKey: job?.data?.dedupeKey,
        error: error?.message || error,
      });
    });

    this.bullReady = true;
  }

  registerHandlers(handlers: WebhookHandlers): void {
    this.handlers = handlers;
    this.initializeBullIfNeeded();
  }

  async enqueue(job: Omit<WebhookIngestJob, 'attempt'>): Promise<void> {
    this.initializeBullIfNeeded();

    if (phase1Flags.useBullMQ && this.queue) {
      const options: JobsOptions = {
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      };
      await this.queue.add('webhook-ingest', job, options);
      return;
    }

    this.jobs.push({ ...job, attempt: 0 });
    this.kick();
  }

  private kick(): void {
    if (this.processing) return;
    this.processing = true;
    setImmediate(() => {
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!;
        await this.processJob(job);
      }
    } finally {
      this.processing = false;
      if (this.jobs.length > 0) this.kick();
    }
  }

  private async processJob(job: WebhookIngestJob): Promise<void> {
    if (!this.handlers) {
      console.warn('[WebhookIngestQueue] handlers não registrados, descartando job.');
      return;
    }

    try {
      if (job.provider === 'whatsapp_official') {
        await this.handlers.processWhatsAppOfficial(job.payload);
      } else {
        await this.handlers.processEvolution(job.payload);
      }
    } catch (error: any) {
      if (job.attempt + 1 >= this.maxAttempts) {
        console.error('[WebhookIngestQueue] job falhou após tentativas máximas:', {
          provider: job.provider,
          dedupeKey: job.dedupeKey,
          error: error?.message || error,
        });
        return;
      }

      const nextAttempt = job.attempt + 1;
      const delayMs = Math.min(30_000, 500 * 2 ** nextAttempt);
      setTimeout(() => {
        this.jobs.push({ ...job, attempt: nextAttempt });
        this.kick();
      }, delayMs);
    }
  }
}

export const webhookIngestQueue = new WebhookIngestQueue();

