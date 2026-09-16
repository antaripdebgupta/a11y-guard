/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { ScanJobProcessor } from './scan-job.processor';
import type { IPageScanner } from '../scanning/page-scanner';
import type { IGitHubClient } from '@a11y-guard/github-client';
import type { ScanResultRepository } from '../persistence/scan-result.repository';
import type { PrismaClient } from '@a11y-guard/db';
import type { ScanJobData } from '@a11y-guard/shared-types';

describe('ScanJobProcessor', () => {
  it('executes full scan pipeline and updates check run and PR comment', async () => {
    const mockScanner: IPageScanner = {
      scan: vi.fn().mockResolvedValue({
        url: 'http://localhost:3000/',
        pageTitle: 'Home',
        axeResults: { violations: [] },
      }),
    };

    const mockGitHubClient: Partial<IGitHubClient> = {
      updateCheckRun: vi.fn().mockResolvedValue(undefined),
      getFileContent: vi.fn().mockResolvedValue(null),
      createComment: vi.fn().mockResolvedValue(123n),
      updateComment: vi.fn().mockResolvedValue(undefined),
    };

    const mockScanRepo: Partial<ScanResultRepository> = {
      getBaselineViolations: vi.fn().mockResolvedValue([]),
      saveScanResult: vi.fn().mockResolvedValue('scan-123'),
    };

    const mockDb: Partial<PrismaClient> = {
      repository: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'repo-1',
          fullName: 'acme/frontend',
        }),
      } as any,
      pullRequest: {
        findUnique: vi.fn().mockResolvedValue({
          reportCommentId: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      } as any,
    };

    const processor = new ScanJobProcessor({
      pageScanner: mockScanner,
      githubClient: mockGitHubClient as IGitHubClient,
      scanRepo: mockScanRepo as ScanResultRepository,
      db: mockDb as PrismaClient,
    });

    const jobData: ScanJobData = {
      correlationId: 'corr-1',
      repositoryId: 'repo-1',
      installationId: 100,
      prNumber: 42,
      commitSha: 'commit-sha-123',
      baseBranch: 'main',
      previewUrl: 'http://localhost:3000',
      checkRunId: 999,
      triggerType: 'pull_request',
    };

    const result = await processor.process(jobData);

    expect(result.scanId).toBe('scan-123');
    expect(result.score).toBe(100);
    expect(result.conclusion).toBe('success');
    expect(mockGitHubClient.updateCheckRun).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        checkRunId: 999,
        conclusion: 'success',
      }),
    );
    expect(mockGitHubClient.createComment).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        issueNumber: 42,
      }),
    );
  });
});
