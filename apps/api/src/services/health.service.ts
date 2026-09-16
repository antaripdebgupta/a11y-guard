import { prisma } from '@a11y-guard/db';
import Redis from 'ioredis';
import { HealthStatusDto } from '@a11y-guard/shared-types';

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function checkRedisHealth(redisUrl: string): Promise<boolean> {
  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
    const pingRes = await redis.ping();
    await redis.quit();
    return pingRes === 'PONG';
  } catch {
    if (redis) {
      try {
        redis.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
    return false;
  }
}

export async function getReadinessStatus(
  redisUrl: string,
  checkDb: () => Promise<boolean> = checkDatabaseHealth,
  checkRedis: (url: string) => Promise<boolean> = checkRedisHealth,
): Promise<{ isReady: boolean; details: HealthStatusDto }> {
  const [dbOk, redisOk] = await Promise.all([checkDb(), checkRedis(redisUrl)]);

  const isReady = dbOk && redisOk;
  return {
    isReady,
    details: {
      status: isReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk,
        redis: redisOk,
      },
    },
  };
}
