import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({ adapter });
  }

  if (!globalThis.__prismaClient) {
    globalThis.__prismaClient = new PrismaClient({ adapter });
  }

  return globalThis.__prismaClient;
}

export const prisma = getPrismaClient();

export * from '@prisma/client';
