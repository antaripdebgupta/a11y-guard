import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GitHub Webhooks Router', () => {
  const app = createApp();

  it('POST /api/v1/webhooks/github returns 501 Not Implemented in Phase 0', async () => {
    const response = await request(app).post('/api/v1/webhooks/github').send({ action: 'opened' });
    expect(response.status).toBe(501);
    expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/v1/healthz returns 200 OK', async () => {
    const response = await request(app).get('/api/v1/healthz');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
