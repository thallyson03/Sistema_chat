import { JobsOptions, Queue, Worker } from 'bullmq';
import crypto from 'crypto';
import { phase1Flags } from '../config/phase1Flags';
import { BotService } from '../services/botService';
import { idempotencyService } from '../services/idempotencyService';
import { getBullRedisConnection } from './redisConnection';

type BotProcessJob = {
  messageContent: string;
  conversationId: string;
  inputMeta?: { messageType?: string; [key: string]: any };
  dedupeKey: string;
};

class BotProcessQueue {
  private readonly queueName = 'bot-process';
  private readonly botService = new BotService();
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private bullReady = false;
  private readonly maxAttempts = 5;
  private readonly jobs: BotProcessJob[] = [];
  private processing = false;

  private initializeBullIfNeeded(): void {
    if (!phase1Flags.useBullMQ || this.bullReady) return;

    const connection = getBullRedisConnection();
    this.queue = new Queue(this.queueName, { connection });
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const data = job.data as BotProcessJob;
        await this.botService.processMessage(data.messageContent, data.conversationId, data.inputMeta);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      console.error('[BotProcessQueue] BullMQ job falhou:', {
        jobId: job?.id,
        dedupeKey: job?.data?.dedupeKey,
        error: error?.message || error,
      });
    });

    this.bullReady = true;
  }

  async enqueue(messageContent: string, conversationId: string, inputMeta?: any): Promise<void> {
    const dedupeKey = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          messageContent,
          conversationId,
          inputMeta,
        }),
      )
      .digest('hex');

    if (!idempotencyService.register(`bot:${dedupeKey}`, 60_000)) return;

    const job: BotProcessJob = { messageContent, conversationId, inputMeta, dedupeKey };
    this.initializeBullIfNeeded();

    if (phase1Flags.useBullMQ && this.queue) {
      const options: JobsOptions = {
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      };
      await this.queue.add('bot-process', job, options);
      return;
    }

    this.jobs.push(job);
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
        try {
          await this.botService.processMessage(job.messageContent, job.conversationId, job.inputMeta);
        } catch (error: any) {
          console.error('[BotProcessQueue] job em memória falhou:', error?.message || error);
        }
      }
    } finally {
      this.processing = false;
      if (this.jobs.length > 0) this.kick();
    }
  }
}

export const botProcessQueue = new BotProcessQueue();

