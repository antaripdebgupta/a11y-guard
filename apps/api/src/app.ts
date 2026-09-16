import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { createErrorMiddleware } from './middleware/error.middleware.js';
import { getReadinessStatus } from './services/health.service.js';

export function createApp(): Express {
  const env = parseEnv();
  const logger = createLogger('api-service');
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
    }),
  );

  // Rate limiting stub
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' } },
  });
  app.use(limiter);

  app.use(express.json());

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      service: 'a11y-guard API',
      version: '0.1.0',
      status: 'ok',
      healthz: '/api/v1/healthz',
      readyz: '/api/v1/readyz',
    });
  });

  // Health check endpoint
  app.get('/api/v1/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check endpoint
  app.get('/api/v1/readyz', async (_req: Request, res: Response) => {
    const readiness = await getReadinessStatus(env.REDIS_URL);
    if (!readiness.isReady) {
      res.status(503).json(readiness.details);
      return;
    }
    res.status(200).json(readiness.details);
  });

  // Global Error Handler
  app.use(createErrorMiddleware(logger));

  return app;
}
