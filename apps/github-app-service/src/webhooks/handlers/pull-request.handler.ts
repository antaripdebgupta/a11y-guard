import { WebhookHandler } from '../dispatcher.js';
import { PullRequestEvent, PullRequestEventSchema, ScanJobData } from '@a11y-guard/shared-types';
import { CheckRunService } from '../../github/check-run.service.js';
import { ScanQueue } from '@a11y-guard/queue';
import { prisma } from '@a11y-guard/db';
import { createLogger, AppLogger } from '@a11y-guard/logger';

export interface PullRequestHandlerDependencies {
  checkRunService: CheckRunService;
  scanQueue: ScanQueue;
  logger?: AppLogger;
}

export class PullRequestHandler implements WebhookHandler<PullRequestEvent> {
  readonly eventType = 'pull_request';
  readonly actions = ['opened', 'synchronize', 'reopened'];

  private readonly checkRunService: CheckRunService;
  private readonly scanQueue: ScanQueue;
  private readonly logger: AppLogger;

  constructor(deps: PullRequestHandlerDependencies) {
    this.checkRunService = deps.checkRunService;
    this.scanQueue = deps.scanQueue;
    this.logger = deps.logger ?? createLogger('pull-request-handler');
  }

  async handle(payload: unknown, ctx: { correlationId: string }): Promise<void> {
    const parsed = PullRequestEventSchema.parse(payload);
    const { action, pull_request: pr, repository: repo, installation } = parsed;

    this.logger.info(
      {
        correlationId: ctx.correlationId,
        action,
        prNumber: pr.number,
        repo: repo.full_name,
        commitSha: pr.head.sha,
      },
      'Processing pull_request webhook',
    );

    const parts = repo.full_name.split('/');
    const owner = parts[0] || repo.owner.login;
    const repoName = parts[1] || repo.name;

    // 1. Create queued Check Run on GitHub immediately
    const checkRunId = await this.checkRunService.createQueuedCheckRun(installation.id, {
      owner,
      repo: repoName,
      headSha: pr.head.sha,
      correlationId: ctx.correlationId,
    });

    // 2. Persist/Upsert organization, installation, repository, and pull request records in DB
    try {
      // Find or create default organization if needed
      let dbRepo = await prisma.repository.findUnique({
        where: { githubRepoId: repo.id },
      });

      if (!dbRepo) {
        let org = await prisma.organization.findFirst({
          where: { slug: owner.toLowerCase() },
        });

        if (!org) {
          org = await prisma.organization.create({
            data: {
              name: owner,
              slug: owner.toLowerCase(),
            },
          });
        }

        let dbInst = await prisma.installation.findUnique({
          where: { githubInstallationId: installation.id },
        });

        if (!dbInst) {
          dbInst = await prisma.installation.create({
            data: {
              organizationId: org.id,
              githubInstallationId: installation.id,
              accountName: owner,
            },
          });
        }

        dbRepo = await prisma.repository.create({
          data: {
            organizationId: org.id,
            githubRepoId: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            isPrivate: repo.private,
          },
        });
      }

      await prisma.pullRequest.upsert({
        where: {
          repositoryId_prNumber: {
            repositoryId: dbRepo.id,
            prNumber: pr.number,
          },
        },
        create: {
          repositoryId: dbRepo.id,
          prNumber: pr.number,
          title: pr.title,
          headSha: pr.head.sha,
          baseSha: pr.base.sha,
          author: pr.user.login,
        },
        update: {
          title: pr.title,
          headSha: pr.head.sha,
          baseSha: pr.base.sha,
        },
      });

      // 3. Enqueue scan job
      const jobData: ScanJobData = {
        correlationId: ctx.correlationId,
        repositoryId: dbRepo.id,
        installationId: installation.id,
        prNumber: pr.number,
        commitSha: pr.head.sha,
        baseBranch: pr.base.ref,
        checkRunId,
        triggerType: 'pull_request',
      };

      await this.scanQueue.enqueue(jobData);
    } catch (err: unknown) {
      this.logger.error({ err }, 'Error persisting PR/enqueueing scan job');
      throw err;
    }
  }
}
