import { describe, it, expect } from 'vitest';
import { parseEnv } from './env.js';

describe('env validation schema', () => {
  it('parses valid environment variables successfully', () => {
    const mockEnv = {
      NODE_ENV: 'development',
      PORT: '3001',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/a11y_guard',
      REDIS_URL: 'redis://localhost:6379',
    };
    const parsed = parseEnv(mockEnv);
    expect(parsed.PORT).toBe(3001);
    expect(parsed.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/a11y_guard');
  });

  it('throws an error if required variable is missing', () => {
    const mockEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: '', // empty
      REDIS_URL: '',
    };
    expect(() => parseEnv(mockEnv)).toThrow('Invalid Environment Variables:');
  });
});
