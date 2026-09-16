import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { PlaywrightAxeScanner } from './scanning/page-scanner';
import { OctokitGitHubClient } from '@a11y-guard/github-client';
import { ScanResultRepository } from './persistence/scan-result.repository';
import { ScanJobProcessor } from './orchestration/scan-job.processor';
import { prisma } from '@a11y-guard/db';
import type { ScanJobData } from '@a11y-guard/shared-types';

export interface SetupWorkerOptions {
  processor?: ScanJobProcessor;
  redisUrl?: string;
}

export function setupScanWorker(options: SetupWorkerOptions = {}) {
  const env = parseEnv();
  const logger = createLogger('scan-worker');

  const connection = new Redis(options.redisUrl || env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  let processor = options.processor;
  if (!processor) {
    const pageScanner = new PlaywrightAxeScanner();
    const githubClient = new OctokitGitHubClient({
      getInstallationToken: async () => 'mock-token',
    });
    const scanRepo = new ScanResultRepository(prisma);

    processor = new ScanJobProcessor({
      pageScanner,
      githubClient,
      scanRepo,
      db: prisma,
    });
  }

  const worker = new Worker(
    'scan-jobs',
    async (job: Job<ScanJobData>) => {
      logger.info({ jobId: job.id, data: job.data }, 'Received scan job from queue');
      if (processor) {
        return await processor.process(job.data);
      }
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
