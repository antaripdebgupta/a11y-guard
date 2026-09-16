import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { createApp } from './app.js';

const env = parseEnv();
const logger = createLogger('api');
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API service listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
