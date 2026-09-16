import { IGitHubClient } from '@a11y-guard/github-client';
import { createLogger, AppLogger } from '@a11y-guard/logger';

export interface CheckRunServiceOptions {
  githubClient: IGitHubClient;
  logger?: AppLogger;
}

export class CheckRunService {
  private readonly githubClient: IGitHubClient;
  private readonly logger: AppLogger;

  constructor(options: CheckRunServiceOptions) {
    this.githubClient = options.githubClient;
    this.logger = options.logger ?? createLogger('check-run-service');
  }

  async createQueuedCheckRun(
    installationId: number,
    params: {
      owner: string;
      repo: string;
      headSha: string;
      correlationId: string;
    },
  ): Promise<number> {
    this.logger.info(
      { correlationId: params.correlationId, headSha: params.headSha },
      'Creating queued Check Run on GitHub',
    );

    const checkRunId = await this.githubClient.createCheckRun(installationId, {
      owner: params.owner,
      repo: params.repo,
      name: 'a11y-guard / Accessibility Gate',
      headSha: params.headSha,
      status: 'queued',
      externalId: params.correlationId,
    });

    return checkRunId;
  }

  async completeCheckRun(
    installationId: number,
    params: {
      owner: string;
      repo: string;
      checkRunId: number;
      conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
      title: string;
      summaryMarkdown: string;
    },
  ): Promise<void> {
    this.logger.info(
      { checkRunId: params.checkRunId, conclusion: params.conclusion },
      'Completing Check Run on GitHub',
    );

    await this.githubClient.updateCheckRun(installationId, {
      owner: params.owner,
      repo: params.repo,
      checkRunId: params.checkRunId,
      status: 'completed',
      conclusion: params.conclusion,
      completedAt: new Date().toISOString(),
      output: {
        title: params.title,
        summary: params.summaryMarkdown,
      },
    });
  }
}
