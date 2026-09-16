import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { parseEnv } from '@a11y-guard/config';
import { createLogger } from '@a11y-guard/logger';
import { verifyWebhookSignature } from './signature.js';
import { WebhookDispatcher } from './dispatcher.js';

export const webhookRouter: Router = Router();
const logger = createLogger('github-webhook-router');

let dispatcherInstance: WebhookDispatcher | null = null;
let redisInstance: Redis | undefined = undefined;

export function configureWebhookRouter(dispatcher: WebhookDispatcher, redis?: Redis): void {
  dispatcherInstance = dispatcher;
  redisInstance = redis;
}

webhookRouter.post('/github', async (req: Request, res: Response): Promise<void> => {
  const env = parseEnv();
  const correlationId = (req.headers['x-github-delivery'] as string) || `deliv-${Date.now()}`;
  const eventType = req.headers['x-github-event'] as string;
  const signatureHeader = req.headers['x-hub-signature-256'] as string;

  // 1. Raw body signature verification
  const rawBody =
    (req as Request & { rawBody?: Buffer | string }).rawBody ||
    (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const isSignatureValid = verifyWebhookSignature(
    rawBody,
    signatureHeader,
    env.GITHUB_WEBHOOK_SECRET,
  );

  if (!isSignatureValid) {
    logger.warn({ correlationId, eventType }, 'Webhook signature verification failed');
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid webhook signature',
      },
    });
    return;
  }

  // 2. Event & Delivery info
  if (!eventType) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing X-GitHub-Event header',
      },
    });
    return;
  }

  const payload = req.body;
  const action = payload?.action;

  // 3. Redis Idempotency check: SETNX
  const deliveryId = correlationId;
  const redis = redisInstance;
  if (redis) {
    try {
      const lockKey = `webhook_delivery:${deliveryId}`;
      const isNew = await redis.set(lockKey, '1', 'EX', 86400, 'NX');
      if (!isNew) {
        logger.info(
          { correlationId, deliveryId, eventType },
          'Duplicate webhook delivery ID detected; skipping',
        );
        res.status(200).json({ status: 'ignored', reason: 'duplicate delivery ID' });
        return;
      }
    } catch (err) {
      logger.warn({ err, correlationId }, 'Redis error during delivery ID idempotency check');
    }
  }

  // 4. Dispatch event
  if (!dispatcherInstance) {
    logger.error({ correlationId }, 'WebhookDispatcher not configured');
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Dispatcher not configured' } });
    return;
  }

  try {
    const handled = await dispatcherInstance.dispatch(eventType, action, payload, correlationId);
    if (!handled) {
      logger.debug({ correlationId, eventType, action }, 'Unhandled webhook event type/action');
    }

    res.status(200).json({ status: 'ok', handled });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, correlationId, eventType, action }, 'Error handling webhook event');
    res.status(500).json({
      error: {
        code: 'HANDLER_ERROR',
        message,
      },
    });
  }
});
