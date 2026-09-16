import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';

export function setupScanWorker() {
  const env = parseEnv();
  const logger = createLogger('scan-worker');

  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    'scan-jobs',
    async (job: Job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing scan job stub');
      return { success: true };
    },
    { connection },
  );

  worker.on('ready', () => {
    logger.info('Scan Worker ready and listening on queue "scan-jobs"');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Scan job failed');
  });

  return { worker, connection };
}
