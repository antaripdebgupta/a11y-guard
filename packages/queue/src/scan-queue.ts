import { Queue, QueueEvents, ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger, AppLogger } from '@a11y-guard/logger';
import { ScanJobData } from '@a11y-guard/shared-types';

export const SCAN_QUEUE_NAME = 'scan-jobs';

export interface ScanQueueOptions {
  redisUrl?: string;
  connection?: Redis | ConnectionOptions;
  logger?: AppLogger;
}

export class ScanQueue {
  private readonly queue: Queue<ScanJobData>;
  private readonly queueEvents: QueueEvents;
  private readonly logger: AppLogger;

  constructor(options: ScanQueueOptions = {}) {
    this.logger = options.logger ?? createLogger('queue');

    let connection: Redis | ConnectionOptions;
    if (options.connection) {
      connection = options.connection;
    } else if (options.redisUrl) {
      connection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
    } else {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
      connection = new Redis({
        host: redisHost,
        port: redisPort,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      });
    }

    this.queue = new Queue<ScanJobData>(SCAN_QUEUE_NAME, { connection });
    this.queueEvents = new QueueEvents(SCAN_QUEUE_NAME, { connection });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error({ jobId, failedReason }, `Job ${jobId} failed in queue ${SCAN_QUEUE_NAME}`);
    });

    this.queueEvents.on('error', (err) => {
      this.logger.error({ err }, `Error in queue events listener for ${SCAN_QUEUE_NAME}`);
    });
  }

  async enqueue(data: ScanJobData): Promise<void> {
    const jobId = `scan:${data.repositoryId}:${data.commitSha}`;
    await this.queue.add('scan', data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: false,
    });
    this.logger.info(
      { jobId, repositoryId: data.repositoryId, commitSha: data.commitSha },
      'Enqueued scan job',
    );
  }

  async getHealth(): Promise<{
    waiting: number;
    active: number;
    failed: number;
    completed: number;
  }> {
    const [waiting, active, failed, completed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
      this.queue.getCompletedCount(),
    ]);
    return { waiting, active, failed, completed };
  }

  async close(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
  }
}
