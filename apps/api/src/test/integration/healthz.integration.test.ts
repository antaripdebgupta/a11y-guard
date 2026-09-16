import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import * as healthService from '../../services/health.service.js';

describe('Health & Readiness API Integration Tests', () => {
  const app = createApp();

  it('GET /api/v1/healthz returns 200 OK', async () => {
    const response = await request(app).get('/api/v1/healthz');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/readyz returns 503 when services are unreachable', async () => {
    vi.spyOn(healthService, 'getReadinessStatus').mockResolvedValueOnce({
      isReady: false,
      details: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: { database: false, redis: false },
      },
    });

    const response = await request(app).get('/api/v1/readyz');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.services).toEqual({
      database: false,
      redis: false,
    });
  });

  it('GET /api/v1/readyz returns 200 when all services are healthy', async () => {
    vi.spyOn(healthService, 'getReadinessStatus').mockResolvedValueOnce({
      isReady: true,
      details: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: { database: true, redis: true },
      },
    });

    const response = await request(app).get('/api/v1/readyz');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.services).toEqual({
      database: true,
      redis: true,
    });
  });
});
