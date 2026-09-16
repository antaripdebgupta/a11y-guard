import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { createApp } from './app.js';

const env = parseEnv();
const logger = createLogger('github-app-service');
const app = createApp();

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : env.GITHUB_APP_SERVICE_PORT || 3001;

const server = app.listen(port, () => {
  logger.info(`GitHub App Service listening on port ${port} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down GitHub App Service...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
