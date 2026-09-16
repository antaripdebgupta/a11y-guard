import { Octokit } from 'octokit';
import { createLogger, AppLogger } from '@a11y-guard/logger';
import {
  IGitHubClient,
  CreateCheckRunParams,
  UpdateCheckRunParams,
  CreateCommentParams,
  UpdateCommentParams,
  GetFileContentParams,
} from './github-client.interface';

export interface OctokitGitHubClientOptions {
  getInstallationToken: (installationId: number) => Promise<string>;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  logger?: AppLogger;
}

export class OctokitGitHubClient implements IGitHubClient {
  private readonly getInstallationTokenFn: (installationId: number) => Promise<string>;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;
  private readonly logger: AppLogger;

  constructor(options: OctokitGitHubClientOptions) {
    this.getInstallationTokenFn = options.getInstallationToken;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 1000;
    this.logger = options.logger ?? createLogger('github-client');
  }

  async getInstallationToken(installationId: number): Promise<string> {
    return this.getInstallationTokenFn(installationId);
  }

  private async getOctokit(installationId: number): Promise<Octokit> {
    const token = await this.getInstallationToken(installationId);
    return new Octokit({ auth: token });
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let delay = this.initialRetryDelayMs;

    while (attempt < this.maxRetries) {
      try {
        return await operation();
      } catch (err: unknown) {
        attempt++;
        const status =
          (
            err as {
              status?: number;
              response?: { status?: number; headers?: Record<string, string> };
            }
          )?.status ?? (err as { response?: { status?: number } })?.response?.status;

        // Do not retry client auth errors (401, 403 non-rate-limit, 404)
        if (status && status >= 400 && status < 500 && status !== 403 && status !== 429) {
          throw err;
        }

        if (attempt >= this.maxRetries) {
          this.logger.error({ err }, 'GitHub API request failed after max retries');
          throw err;
        }

        // Respect Retry-After if available
        const retryAfter = (err as { response?: { headers?: Record<string, string> } })?.response
          ?.headers?.['retry-after'];
        const backoffMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

        this.logger.warn(
          { attempt, status, backoffMs },
          `Retrying GitHub API call due to transient error/rate-limit`,
        );

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        delay *= 2;
      }
    }

    throw new Error('GitHub API request failed after max retries');
  }

  async createCheckRun(installationId: number, params: CreateCheckRunParams): Promise<number> {
    return this.withRetry(async () => {
      const octokit = await this.getOctokit(installationId);
      const res = await octokit.rest.checks.create({
        owner: params.owner,
        repo: params.repo,
        name: params.name,
        head_sha: params.headSha,
        status: params.status,
        started_at: params.startedAt,
        external_id: params.externalId,
      });
      return res.data.id;
    });
  }

  async updateCheckRun(installationId: number, params: UpdateCheckRunParams): Promise<void> {
    await this.withRetry(async () => {
      const octokit = await this.getOctokit(installationId);
      await octokit.rest.checks.update({
        owner: params.owner,
        repo: params.repo,
        check_run_id: params.checkRunId,
        status: params.status,
        conclusion: params.conclusion,
        completed_at: params.completedAt,
        output: params.output,
      });
    });
  }

  async createComment(installationId: number, params: CreateCommentParams): Promise<bigint> {
    return this.withRetry(async () => {
      const octokit = await this.getOctokit(installationId);
      const res = await octokit.rest.issues.createComment({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        body: params.body,
      });
      return BigInt(res.data.id);
    });
  }

  async updateComment(installationId: number, params: UpdateCommentParams): Promise<void> {
    await this.withRetry(async () => {
      const octokit = await this.getOctokit(installationId);
      await octokit.rest.issues.updateComment({
        owner: params.owner,
        repo: params.repo,
        comment_id: Number(params.commentId),
        body: params.body,
      });
    });
  }

  async getFileContent(
    installationId: number,
    params: GetFileContentParams,
  ): Promise<string | null> {
    return this.withRetry(async () => {
      const octokit = await this.getOctokit(installationId);
      try {
        const res = await octokit.rest.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          ref: params.ref,
        });

        if ('content' in res.data && typeof res.data.content === 'string') {
          return Buffer.from(res.data.content, 'base64').toString('utf8');
        }
        return null;
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404) {
          return null;
        }
        throw err;
      }
    });
  }
}
