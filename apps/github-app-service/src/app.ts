import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { webhookRouter } from './webhooks/router.js';

export function createApp(): Express {
  const env = parseEnv();
  const logger = createLogger('github-app-service');
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
    }),
  );

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use(express.json());

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      service: 'a11y-guard GitHub App Service',
      version: '0.1.0',
      status: 'ok',
      healthz: '/api/v1/healthz',
      webhooks: '/api/v1/webhooks/github',
    });
  });

  app.get('/api/v1/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/webhooks', webhookRouter);

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
    logger.error({ err }, `Unhandled error in GitHub App Service: ${err.message}`);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      },
    });
  });

  return app;
}
