import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient();
  }

  if (!globalThis.__prismaClient) {
    globalThis.__prismaClient = new PrismaClient();
  }

  return globalThis.__prismaClient;
}

export const prisma = getPrismaClient();

export * from '@prisma/client';
