import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

type QueueSnapshot = Record<
  string,
  {
    enqueued: number;
    processed: number;
    failed: number;
    retried: number;
  }
>;

class PrometheusService {
  private readonly registry: Registry;

  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;

  private readonly httpRequestDurationMs: Histogram<'method' | 'route' | 'status_code'>;

  private readonly queueCounterGauge: Gauge<'queue' | 'event'>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'crm_' });

    this.httpRequestsTotal = new Counter({
      name: 'crm_http_requests_total',
      help: 'Total HTTP requests by method, route and status code',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'crm_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2500, 5000, 10000],
      registers: [this.registry],
    });

    this.queueCounterGauge = new Gauge({
      name: 'crm_queue_counters',
      help: 'Queue counters snapshot by queue and event',
      labelNames: ['queue', 'event'],
      registers: [this.registry],
    });
  }

  observeHttpRequest(data: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const method = String(data.method || 'UNKNOWN').toUpperCase();
    const route = data.route || 'unknown_route';
    const statusCode = String(data.statusCode || 0);

    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDurationMs.observe(
      { method, route, status_code: statusCode },
      Math.max(0, data.durationMs || 0),
    );
  }

  updateQueueCounters(snapshot: QueueSnapshot): void {
    Object.entries(snapshot).forEach(([queue, values]) => {
      this.queueCounterGauge.set({ queue, event: 'enqueued' }, values.enqueued || 0);
      this.queueCounterGauge.set({ queue, event: 'processed' }, values.processed || 0);
      this.queueCounterGauge.set({ queue, event: 'failed' }, values.failed || 0);
      this.queueCounterGauge.set({ queue, event: 'retried' }, values.retried || 0);
    });
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

export const prometheusService = new PrometheusService();
