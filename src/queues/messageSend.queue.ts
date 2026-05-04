import { MessageService } from '../services/messageService';
import { JobsOptions, Queue, Worker } from 'bullmq';
import { phase1Flags } from '../config/phase1Flags';
import { queueMetricsService } from '../services/queueMetricsService';
import { getBullRedisConnection } from './redisConnection';

type MessageSendJob = {
  data: any;
  dedupeKey: string;
  attempt: number;
};

class MessageSendQueue {
  private readonly jobs: MessageSendJob[] = [];
  private processing = false;
  private readonly maxAttempts = 5;
  private readonly messageService = new MessageService();
  private readonly queueName = 'message-send';
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
        const data = (job.data as MessageSendJob).data;
        await this.messageService.sendMessage(data);
      },
      { connection },
    );

    this.worker.on('completed', () => {
      queueMetricsService.incrementProcessed(this.queueName);
    });

    this.worker.on('failed', (job, error) => {
      queueMetricsService.incrementFailed(this.queueName);
      const maxAttempts = Number(job?.opts?.attempts || this.maxAttempts);
      const attemptsMade = Number(job?.attemptsMade || 0);
      if (attemptsMade < maxAttempts) {
        queueMetricsService.incrementRetried(this.queueName);
      }
      console.error('[MessageSendQueue] BullMQ job falhou:', {
        jobId: job?.id,
        dedupeKey: job?.data?.dedupeKey,
        error: error?.message || error,
      });
    });

    this.bullReady = true;
  }

  async enqueue(data: any, dedupeKey: string): Promise<void> {
    this.initializeBullIfNeeded();
    queueMetricsService.incrementEnqueued(this.queueName);

    if (phase1Flags.useBullMQ && this.queue) {
      const options: JobsOptions = {
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      };
      await this.queue.add('message-send', { data, dedupeKey, attempt: 0 }, options);
      return;
    }

    this.jobs.push({ data, dedupeKey, attempt: 0 });
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

  private async processJob(job: MessageSendJob): Promise<void> {
    try {
      await this.messageService.sendMessage(job.data);
      queueMetricsService.incrementProcessed(this.queueName);
    } catch (error: any) {
      queueMetricsService.incrementFailed(this.queueName);
      if (job.attempt + 1 >= this.maxAttempts) {
        console.error('[MessageSendQueue] job falhou após tentativas máximas:', {
          dedupeKey: job.dedupeKey,
          error: error?.message || error,
        });
        return;
      }

      const nextAttempt = job.attempt + 1;
      const delayMs = Math.min(30_000, 500 * 2 ** nextAttempt);
      queueMetricsService.incrementRetried(this.queueName);
      setTimeout(() => {
        this.jobs.push({ ...job, attempt: nextAttempt });
        this.kick();
      }, delayMs);
    }
  }

  async getStats(): Promise<Record<string, any>> {
    const base = {
      mode: phase1Flags.useBullMQ ? 'bullmq' : 'memory',
      inMemoryPending: this.jobs.length,
    };

    if (phase1Flags.useBullMQ && this.queue) {
      const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return { ...base, bullmq: counts };
    }

    return base;
  }
}

export const messageSendQueue = new MessageSendQueue();

