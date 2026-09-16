import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  GITHUB_APP_SERVICE_PORT: z.string().transform(Number).default('3002'),
  WEB_PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/a11y_guard?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  MINIO_ENDPOINT: z.string().min(1).default('localhost'),
  MINIO_PORT: z.string().transform(Number).default('9000'),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MINIO_BUCKET: z.string().min(1).default('artifacts'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.string().transform(Number).default('1025'),
  GITHUB_APP_ID: z.string().min(1).default('123456'),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().min(1).default('./github-app-private-key.pem'),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).default('dev_webhook_secret_do_not_use_in_prod'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(customEnv?: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(customEnv || process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid Environment Variables:\n${errorDetails}`);
  }
  return result.data;
}

// Global parsed env instance (lazy initialized or initialized on import)
let _envInstance: Env | undefined;

export function getEnv(): Env {
  if (!_envInstance) {
    _envInstance = parseEnv();
  }
  return _envInstance;
}
