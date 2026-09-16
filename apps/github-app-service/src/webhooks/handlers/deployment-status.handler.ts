import { WebhookHandler } from '../dispatcher.js';
import {
  DeploymentStatusEvent,
  DeploymentStatusEventSchema,
  ScanJobData,
} from '@a11y-guard/shared-types';
import { ScanQueue } from '@a11y-guard/queue';
import { prisma } from '@a11y-guard/db';
import { createLogger, AppLogger } from '@a11y-guard/logger';

export interface DeploymentStatusHandlerDependencies {
  scanQueue: ScanQueue;
  logger?: AppLogger;
}

export class DeploymentStatusHandler implements WebhookHandler<DeploymentStatusEvent> {
  readonly eventType = 'deployment_status';
  readonly actions = undefined; // all deployment_status actions

  private readonly scanQueue: ScanQueue;
  private readonly logger: AppLogger;

  constructor(deps: DeploymentStatusHandlerDependencies) {
    this.scanQueue = deps.scanQueue;
    this.logger = deps.logger ?? createLogger('deployment-status-handler');
  }

  async handle(payload: unknown, ctx: { correlationId: string }): Promise<void> {
    const parsed = DeploymentStatusEventSchema.parse(payload);
    const { deployment_status, deployment, repository: repo, installation } = parsed;

    if (deployment_status.state !== 'success') {
      this.logger.debug(
        { correlationId: ctx.correlationId, state: deployment_status.state },
        'Ignoring deployment_status event with non-success state',
      );
      return;
    }

    const targetUrl = deployment_status.target_url || deployment_status.environment_url;
    if (!targetUrl) {
      this.logger.warn(
        { correlationId: ctx.correlationId },
        'deployment_status success missing target_url',
      );
      return;
    }

    this.logger.info(
      { correlationId: ctx.correlationId, sha: deployment.sha, targetUrl },
      'Received successful deployment status with preview URL',
    );

    const dbRepo = await prisma.repository.findUnique({
      where: { githubRepoId: repo.id },
    });

    if (!dbRepo) {
      this.logger.warn(
        { githubRepoId: repo.id },
        'Repository not found in DB for deployment_status',
      );
      return;
    }

    // Re-enqueue or update scan job context with preview URL
    const jobData: ScanJobData = {
      correlationId: ctx.correlationId,
      repositoryId: dbRepo.id,
      installationId: installation.id,
      commitSha: deployment.sha,
      baseBranch: repo.default_branch,
      previewUrl: targetUrl,
      checkRunId: 0, // 0 if not linked to explicit PR check run yet
      triggerType: 'push',
    };

    await this.scanQueue.enqueue(jobData);
  }
}
