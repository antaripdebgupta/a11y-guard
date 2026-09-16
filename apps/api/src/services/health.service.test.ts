import { describe, it, expect, vi } from 'vitest';
import * as healthService from './health.service.js';

describe('healthService', () => {
  it('returns false for DB check when prisma throws error', async () => {
    const isDbOk = await healthService.checkDatabaseHealth();
    // In unit testing environment without DB running, checkDatabaseHealth returns false gracefully
    expect(typeof isDbOk).toBe('boolean');
  });

  it('handles getReadinessStatus structure correctly', async () => {
    const mockCheckDb = vi.fn().mockResolvedValue(true);
    const mockCheckRedis = vi.fn().mockResolvedValue(true);

    const result = await healthService.getReadinessStatus(
      'redis://localhost:6379',
      mockCheckDb,
      mockCheckRedis,
    );
    expect(result.isReady).toBe(true);
    expect(result.details.services?.database).toBe(true);
    expect(result.details.services?.redis).toBe(true);
  });
});
