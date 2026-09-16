import { createLogger } from '@a11y-guard/logger';
import { setupScanWorker } from './worker.js';

const logger = createLogger('scan-worker');

logger.info('Initializing Scan Worker service...');

const { worker, connection } = setupScanWorker();

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down worker...`);
  await worker.close();
  await connection.quit();
  logger.info('Worker connection closed.');
  process.exit(0);
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
