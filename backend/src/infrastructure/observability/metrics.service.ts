import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsService {
  public register: Registry;
  public jobsProcessed: Counter;
  public jobsDuration: Histogram;
  public jobsWaiting: Gauge;
  public jobsFailed: Counter;

  constructor() {
    this.register = new Registry();

    // Add default node metrics (cpu, mem, etc.)
    collectDefaultMetrics({ register: this.register });

    this.jobsProcessed = new Counter({
      name: 'jobs_processed_total',
      help: 'Total number of jobs processed',
      labelNames: ['queue', 'status'],
      registers: [this.register]
    });

    this.jobsDuration = new Histogram({
      name: 'jobs_processing_duration_seconds',
      help: 'Duration of job processing in seconds',
      labelNames: ['queue'],
      registers: [this.register]
    });

    this.jobsWaiting = new Gauge({
      name: 'jobs_waiting_count',
      help: 'Number of jobs waiting in queue',
      labelNames: ['queue'],
      registers: [this.register]
    });

    this.jobsFailed = new Counter({
      name: 'jobs_failed_total',
      help: 'Total number of failed jobs',
      labelNames: ['queue'],
      registers: [this.register]
    });
  }

  public incrementJobsProcessed(queue: string, status: 'completed' | 'failed') {
    this.jobsProcessed.inc({ queue, status });
  }

  public observeJobDuration(queue: string, durationSeconds: number) {
    this.jobsDuration.observe({ queue }, durationSeconds);
  }

  public setJobsWaiting(queue: string, count: number) {
    this.jobsWaiting.set({ queue }, count);
  }

  public incrementJobsFailed(queue: string) {
    this.jobsFailed.inc({ queue });
  }

  public async getMetrics() {
    return this.register.metrics();
  }

  public getContentType() {
    return this.register.contentType;
  }
}

export const metricsService = new MetricsService();
