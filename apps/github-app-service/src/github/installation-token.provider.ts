import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { createLogger, AppLogger } from '@a11y-guard/logger';

export interface InstallationTokenProviderOptions {
  appId: string;
  privateKey: string;
  redis?: Redis;
  logger?: AppLogger;
}

export class InstallationTokenProvider {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly redis?: Redis;
  private readonly logger: AppLogger;

  constructor(options: InstallationTokenProviderOptions) {
    this.appId = options.appId;
    this.privateKey = options.privateKey;
    this.redis = options.redis;
    this.logger = options.logger ?? createLogger('installation-token-provider');
  }

  private generateAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // 1 minute in past for clock drift
      exp: now + 600, // 10 minutes max
      iss: this.appId,
    };
    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  async getInstallationToken(installationId: number): Promise<string> {
    const cacheKey = `installation_token:${installationId}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (err) {
        this.logger.warn({ err }, 'Redis error when reading installation token cache');
      }
    }

    let attempt = 0;
    const maxRetries = 3;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        attempt++;
        const appJwt = this.generateAppJwt();
        const response = await fetch(
          `https://api.github.com/app/installations/${installationId}/access_tokens`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${appJwt}`,
              'User-Agent': 'a11y-guard-app',
            },
          },
        );

        if (!response.ok) {
          const status = response.status;
          if (status === 401 || status === 403) {
            const body = await response.text();
            throw new Error(`GitHub token exchange failed (${status}): ${body}`);
          }
          throw new Error(`GitHub token exchange HTTP error ${status}`);
        }

        const data = (await response.json()) as { token: string; expires_at: string };
        const token = data.token;
        const expiresAt = new Date(data.expires_at).getTime();
        const ttlSeconds = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000) - 300); // expiry minus 5 mins

        if (this.redis) {
          try {
            await this.redis.set(cacheKey, token, 'EX', ttlSeconds);
          } catch (err) {
            this.logger.warn({ err }, 'Redis error when caching installation token');
          }
        }

        return token;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt >= maxRetries || message.includes('401') || message.includes('403')) {
          this.logger.error(
            { err, installationId, attempt },
            'Failed to obtain installation token',
          );
          throw err;
        }

        this.logger.warn(
          { attempt, delay, err: message },
          'Retrying GitHub installation token request',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error(`Failed to obtain installation token for installation ${installationId}`);
  }
}
