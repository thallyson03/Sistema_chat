import { JobsOptions, Queue, Worker } from 'bullmq';
import crypto from 'crypto';
import { phase1Flags } from '../config/phase1Flags';
import { PipelineAutomationService } from '../services/pipelineAutomationService';
import { idempotencyService } from '../services/idempotencyService';
import { getBullRedisConnection } from './redisConnection';

type PipelineAutomationJob = {
  dealId: string;
  stageId: string;
  isNewDeal: boolean;
  triggerType?: string;
  dedupeKey: string;
};

class PipelineAutomationQueue {
  private readonly queueName = 'pipeline-automation';
  private readonly pipelineAutomationService = new PipelineAutomationService();
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private bullReady = false;
  private readonly maxAttempts = 5;
  private readonly jobs: PipelineAutomationJob[] = [];
  private processing = false;

  private initializeBullIfNeeded(): void {
    if (!phase1Flags.useBullMQ || this.bullReady) return;

    const connection = getBullRedisConnection();
    this.queue = new Queue(this.queueName, { connection });
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const data = job.data as PipelineAutomationJob;
        await this.pipelineAutomationService.handleStageEnterInline(
          data.dealId,
          data.stageId,
          data.isNewDeal,
          data.triggerType,
        );
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      console.error('[PipelineAutomationQueue] BullMQ job falhou:', {
        jobId: job?.id,
        dedupeKey: job?.data?.dedupeKey,
        error: error?.message || error,
      });
    });

    this.bullReady = true;
  }

  async enqueue(dealId: string, stageId: string, isNewDeal = false, triggerType?: string): Promise<void> {
    const dedupeKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ dealId, stageId, isNewDeal, triggerType }))
      .digest('hex');

    if (!idempotencyService.register(`pipeline-automation:${dedupeKey}`, 30_000)) return;

    const job: PipelineAutomationJob = { dealId, stageId, isNewDeal, triggerType, dedupeKey };
    this.initializeBullIfNeeded();

    if (phase1Flags.useBullMQ && this.queue) {
      const options: JobsOptions = {
        attempts: this.maxAttempts,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: true,
        removeOnFail: false,
      };
      await this.queue.add('pipeline-automation', job, options);
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
          await this.pipelineAutomationService.handleStageEnterInline(
            job.dealId,
            job.stageId,
            job.isNewDeal,
            job.triggerType,
          );
        } catch (error: any) {
          console.error('[PipelineAutomationQueue] job em memória falhou:', error?.message || error);
        }
      }
    } finally {
      this.processing = false;
      if (this.jobs.length > 0) this.kick();
    }
  }
}

export const pipelineAutomationQueue = new PipelineAutomationQueue();

