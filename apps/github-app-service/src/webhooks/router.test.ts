import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app.js';
import { WebhookDispatcher } from './dispatcher.js';
import type { Express } from 'express';
import { parseEnv } from '@a11y-guard/config';
import prOpenedFixture from '../../../../infra/fixtures/webhook-payloads/pull_request.opened.json';

function signPayload(payload: object | string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  hmac.update(data);
  return `sha256=${hmac.digest('hex')}`;
}

describe('GitHub Webhooks Router', () => {
  const env = parseEnv();
  const webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  let app: Express;
  let mockDispatcher: WebhookDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatcher = new WebhookDispatcher();
    app = createApp({ dispatcher: mockDispatcher });
  });

  it('POST /api/v1/webhooks/github rejects invalid signature with 401', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/github')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', 'sha256=invalid-signature')
      .send({ action: 'opened' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/webhooks/github accepts valid signature and dispatches event', async () => {
    const rawPayload = JSON.stringify(prOpenedFixture);
    const signature = signPayload(rawPayload, webhookSecret);
    const mockHandler = {
      eventType: 'pull_request',
      actions: ['opened'],
      handle: vi.fn().mockResolvedValue(undefined),
    };
    mockDispatcher.register(mockHandler);

    const deliveryId = `delivery-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const response = await request(app)
      .post('/api/v1/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', deliveryId)
      .set('X-Hub-Signature-256', signature)
      .send(rawPayload);

    expect(response.status).toBe(200);
    expect(response.body.handled).toBe(true);
    expect(mockHandler.handle).toHaveBeenCalledWith(expect.objectContaining({ action: 'opened' }), {
      correlationId: deliveryId,
    });
  });

  it('ignores unhandled action or event cleanly with 200', async () => {
    const payload = { action: 'labeled' };
    const rawPayload = JSON.stringify(payload);
    const signature = signPayload(rawPayload, webhookSecret);

    const response = await request(app)
      .post('/api/v1/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', signature)
      .send(rawPayload);

    expect(response.status).toBe(200);
    expect(response.body.handled).toBe(false);
  });

  it('GET /api/v1/healthz returns 200 OK', async () => {
    const response = await request(app).get('/api/v1/healthz');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
