import { prometheusService } from './prometheusService';

type QueueCounters = {
  enqueued: number;
  processed: number;
  failed: number;
  retried: number;
};

type QueueMetricsMap = Record<string, QueueCounters>;

class QueueMetricsService {
  private readonly counters: QueueMetricsMap = {};

  private ensureQueue(queueName: string): QueueCounters {
    if (!this.counters[queueName]) {
      this.counters[queueName] = {
        enqueued: 0,
        processed: 0,
        failed: 0,
        retried: 0,
      };
    }
    return this.counters[queueName];
  }

  incrementEnqueued(queueName: string): void {
    this.ensureQueue(queueName).enqueued += 1;
    this.syncPrometheus();
  }

  incrementProcessed(queueName: string): void {
    this.ensureQueue(queueName).processed += 1;
    this.syncPrometheus();
  }

  incrementFailed(queueName: string): void {
    this.ensureQueue(queueName).failed += 1;
    this.syncPrometheus();
  }

  incrementRetried(queueName: string): void {
    this.ensureQueue(queueName).retried += 1;
    this.syncPrometheus();
  }

  snapshot(): QueueMetricsMap {
    return Object.entries(this.counters).reduce<QueueMetricsMap>((acc, [queue, values]) => {
      acc[queue] = { ...values };
      return acc;
    }, {});
  }

  private syncPrometheus(): void {
    prometheusService.updateQueueCounters(this.snapshot());
  }
}

export const queueMetricsService = new QueueMetricsService();

