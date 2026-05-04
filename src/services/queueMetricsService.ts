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
  }

  incrementProcessed(queueName: string): void {
    this.ensureQueue(queueName).processed += 1;
  }

  incrementFailed(queueName: string): void {
    this.ensureQueue(queueName).failed += 1;
  }

  incrementRetried(queueName: string): void {
    this.ensureQueue(queueName).retried += 1;
  }

  snapshot(): QueueMetricsMap {
    return Object.entries(this.counters).reduce<QueueMetricsMap>((acc, [queue, values]) => {
      acc[queue] = { ...values };
      return acc;
    }, {});
  }
}

export const queueMetricsService = new QueueMetricsService();

