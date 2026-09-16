import type { IPageScanner } from '../scanning/page-scanner';
import type { IGitHubClient } from '@a11y-guard/github-client';
import { PrCommentService } from '@a11y-guard/github-client';
import type { ScanResultRepository } from '../persistence/scan-result.repository';
import type { PrismaClient } from '@a11y-guard/db';
import type {
  ScanJobData,
  RawAxeResult,
  NormalizedViolation,
  ScanSummary,
} from '@a11y-guard/shared-types';
import { parseRouteConfig, getDefaultRouteConfig } from '../config/route-config.parser';
import {
  normalizeAxeViolations,
  computeScore,
  diffViolations,
  computeCheckConclusion,
} from '@a11y-guard/analyzer';
import { generatePrComment } from '@a11y-guard/report-generator';
import { createLogger } from '@a11y-guard/logger';

export interface ScanJobProcessorDependencies {
  pageScanner: IPageScanner;
  githubClient: IGitHubClient;
  scanRepo: ScanResultRepository;
  db: PrismaClient;
  prCommentService?: PrCommentService;
}

export class ScanJobProcessor {
  private logger = createLogger('ScanJobProcessor');
  private prCommentService: PrCommentService;

  constructor(private deps: ScanJobProcessorDependencies) {
    this.prCommentService =
      deps.prCommentService || new PrCommentService(deps.githubClient, deps.db);
  }

  async process(jobData: ScanJobData): Promise<ScanSummary> {
    const startTime = Date.now();
    this.logger.info(
      { correlationId: jobData.correlationId, commitSha: jobData.commitSha },
      'Starting scan job execution',
    );

    // 1. Fetch Repository from DB
    const repoRecord = await this.deps.db.repository.findUnique({
      where: { id: jobData.repositoryId },
    });

    if (!repoRecord) {
      throw new Error(`Repository record not found for id: ${jobData.repositoryId}`);
    }

    const [owner, repoName] = repoRecord.fullName.split('/');

    // 2. Update Check Run status to in_progress
    if (jobData.checkRunId && owner && repoName) {
      try {
        await this.deps.githubClient.updateCheckRun(jobData.installationId, {
          owner,
          repo: repoName,
          checkRunId: jobData.checkRunId,
          status: 'in_progress',
        });
      } catch (err) {
        this.logger.warn({ err }, 'Failed to update check run status to in_progress');
      }
    }

    // 3. Fetch Route Config (.a11yguard.yml) from GitHub repo
    let config = getDefaultRouteConfig();
    let configFound = false;

    if (owner && repoName) {
      try {
        const yamlContent = await this.deps.githubClient.getFileContent(jobData.installationId, {
          owner,
          repo: repoName,
          path: '.a11yguard.yml',
          ref: jobData.commitSha,
        });

        if (yamlContent) {
          config = parseRouteConfig(yamlContent);
          configFound = true;
          this.logger.info({ config }, 'Parsed custom .a11yguard.yml configuration');
        }
      } catch (err) {
        this.logger.info({ err }, 'Using default route configuration fallback');
      }
    }

    // 4. Determine Target URLs to scan
    const baseUrl = jobData.previewUrl || 'http://localhost:3000';
    const targetUrls = config.routes.map((r: { path: string }) => {
      if (r.path.startsWith('http://') || r.path.startsWith('https://')) return r.path;
      return `${baseUrl.replace(/\/$/, '')}${r.path.startsWith('/') ? '' : '/'}${r.path}`;
    });

    // 5. Run Page Scanner
    const rawResults: RawAxeResult[] = [];
    const allNormalizedViolations: NormalizedViolation[] = [];

    for (const url of targetUrls) {
      try {
        const result = await this.deps.pageScanner.scan(url, {
          timeoutMs: config.options?.timeoutMs,
        });
        rawResults.push(result);
        const normalized = normalizeAxeViolations(result);
        allNormalizedViolations.push(...normalized);
      } catch (err) {
        this.logger.error({ err, url }, 'Failed to scan page URL');
      }
    }

    // 6. Calculate Score & Baseline Diff
    const score = computeScore(allNormalizedViolations);
    const baselineViolations = await this.deps.scanRepo.getBaselineViolations(jobData.repositoryId);
    const diff = diffViolations(baselineViolations, allNormalizedViolations);
    const gateEval = computeCheckConclusion(diff, config.gate);

    // 7. Save Scan Results to DB
    const scanId = await this.deps.scanRepo.saveScanResult({
      repositoryId: jobData.repositoryId,
      pullRequestId: jobData.prNumber ? undefined : undefined,
      commitSha: jobData.commitSha,
      score,
      scanPages: rawResults.map((r) => ({
        url: r.url,
        title: r.pageTitle,
        violations: normalizeAxeViolations(r),
      })),
    });

    const scanSummary: ScanSummary = {
      scanId,
      commitSha: jobData.commitSha,
      repositoryFullName: repoRecord.fullName,
      prNumber: jobData.prNumber,
      score,
      conclusion: gateEval.conclusion,
      diff,
      scannedPagesCount: targetUrls.length,
      durationMs: Date.now() - startTime,
      configFound,
    };

    // 8. Generate & Post PR Comment (if PR number present)
    if (jobData.prNumber && owner && repoName) {
      try {
        const commentMarkdown = generatePrComment(scanSummary);
        await this.prCommentService.upsertPrComment({
          installationId: jobData.installationId,
          owner,
          repo: repoName,
          prNumber: jobData.prNumber,
          repositoryId: jobData.repositoryId,
          body: commentMarkdown,
        });
      } catch (err) {
        this.logger.error({ err, prNumber: jobData.prNumber }, 'Failed to post/update PR comment');
      }
    }

    // 9. Update Check Run status to completed
    if (jobData.checkRunId && owner && repoName) {
      try {
        await this.deps.githubClient.updateCheckRun(jobData.installationId, {
          owner,
          repo: repoName,
          checkRunId: jobData.checkRunId,
          status: 'completed',
          conclusion: gateEval.conclusion,
          completedAt: new Date().toISOString(),
          output: {
            title: `Accessibility Check: ${gateEval.conclusion.toUpperCase()}`,
            summary: gateEval.summary,
            text: generatePrComment(scanSummary),
          },
        });
      } catch (err) {
        this.logger.error(
          { err, checkRunId: jobData.checkRunId },
          'Failed to update check run completion status',
        );
      }
    }

    this.logger.info(
      { scanId, conclusion: gateEval.conclusion, durationMs: scanSummary.durationMs },
      'Completed scan job execution',
    );
    return scanSummary;
  }
}
