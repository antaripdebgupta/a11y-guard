import type { IGitHubClient } from './github-client.interface';
import type { PrismaClient } from '@a11y-guard/db';
import { createLogger } from '@a11y-guard/logger';

export interface UpsertPrCommentOptions {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  repositoryId: string;
  body: string;
}

export class PrCommentService {
  private logger = createLogger('PrCommentService');

  constructor(
    private githubClient: IGitHubClient,
    private db: PrismaClient,
  ) {}

  async upsertPrComment(options: UpsertPrCommentOptions): Promise<bigint> {
    const { installationId, owner, repo, prNumber, repositoryId, body } = options;

    const pr = await this.db.pullRequest.findUnique({
      where: {
        repositoryId_prNumber: { repositoryId, prNumber },
      },
    });

    if (pr?.reportCommentId) {
      try {
        await this.githubClient.updateComment(installationId, {
          owner,
          repo,
          commentId: pr.reportCommentId,
          body,
        });
        this.logger.info(
          { prNumber, commentId: pr.reportCommentId.toString() },
          'Updated existing PR comment',
        );
        return pr.reportCommentId;
      } catch (err) {
        this.logger.warn(
          { err, commentId: pr.reportCommentId.toString() },
          'Failed to update existing PR comment, fallback to create comment',
        );
      }
    }

    const newCommentId = await this.githubClient.createComment(installationId, {
      owner,
      repo,
      issueNumber: prNumber,
      body,
    });

    await this.db.pullRequest.update({
      where: {
        repositoryId_prNumber: { repositoryId, prNumber },
      },
      data: {
        reportCommentId: newCommentId,
      },
    });

    this.logger.info(
      { prNumber, commentId: newCommentId.toString() },
      'Created new PR comment and saved reportCommentId',
    );
    return newCommentId;
  }
}
