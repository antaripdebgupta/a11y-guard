import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { OctokitGitHubClient } from '@a11y-guard/github-client';
import { ScanQueue } from '@a11y-guard/queue';
import { webhookRouter, configureWebhookRouter } from './webhooks/router.js';
import { WebhookDispatcher } from './webhooks/dispatcher.js';
import { InstallationTokenProvider } from './github/installation-token.provider.js';
import { CheckRunService } from './github/check-run.service.js';
import { PullRequestHandler } from './webhooks/handlers/pull-request.handler.js';
import { DeploymentStatusHandler } from './webhooks/handlers/deployment-status.handler.js';

export interface CreateAppOptions {
  dispatcher?: WebhookDispatcher;
  redis?: Redis;
}

export function createApp(options: CreateAppOptions = {}): Express {
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

  // Preserve rawBody for HMAC-SHA256 signature verification
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  let redisClient: Redis | undefined;
  try {
    redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  } catch (err) {
    logger.warn({ err }, 'Could not initialize Redis client for GitHub App Service');
  }

  const scanQueue = new ScanQueue({ redisUrl: env.REDIS_URL, logger });

  const tokenProvider = new InstallationTokenProvider({
    appId: env.GITHUB_APP_ID || '12345',
    privateKey: env.GITHUB_APP_PRIVATE_KEY || 'dummy-key',
    redis: redisClient,
    logger,
  });

  const githubClient = new OctokitGitHubClient({
    getInstallationToken: (instId) => tokenProvider.getInstallationToken(instId),
    logger,
  });

  const checkRunService = new CheckRunService({
    githubClient,
    logger,
  });

  const dispatcher = options.dispatcher ?? new WebhookDispatcher();
  if (!options.dispatcher) {
    dispatcher.register(
      new PullRequestHandler({
        checkRunService,
        scanQueue,
        logger,
      }),
    );
    dispatcher.register(
      new DeploymentStatusHandler({
        scanQueue,
        logger,
      }),
    );
  }

  configureWebhookRouter(dispatcher, options.redis ?? redisClient);

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

  app.get('/internal/queue/health', async (_req: Request, res: Response) => {
    try {
      const health = await scanQueue.getHealth();
      res.status(200).json({ status: 'ok', queue: health });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', message });
    }
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
