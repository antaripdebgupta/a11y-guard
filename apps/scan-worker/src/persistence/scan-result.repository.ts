import type { PrismaClient, Prisma, ImpactLevel } from '@a11y-guard/db';
import type { NormalizedViolation } from '@a11y-guard/shared-types';
import { createLogger } from '@a11y-guard/logger';

export interface SaveScanInput {
  repositoryId: string;
  pullRequestId?: string;
  commitSha: string;
  score: number;
  scanPages: Array<{
    url: string;
    title?: string;
    violations: NormalizedViolation[];
  }>;
}

const SEVERITY_TO_IMPACT: Record<string, ImpactLevel> = {
  critical: 'CRITICAL',
  serious: 'SERIOUS',
  moderate: 'MODERATE',
  minor: 'MINOR',
};

const IMPACT_TO_SEVERITY: Record<ImpactLevel, 'critical' | 'serious' | 'moderate' | 'minor'> = {
  CRITICAL: 'critical',
  SERIOUS: 'serious',
  MODERATE: 'moderate',
  MINOR: 'minor',
};

export class ScanResultRepository {
  private logger = createLogger('ScanResultRepository');

  constructor(private db: PrismaClient) {}

  async saveScanResult(input: SaveScanInput): Promise<string> {
    const { repositoryId, pullRequestId, commitSha, score, scanPages } = input;

    const result = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const scan = await tx.scan.create({
        data: {
          repositoryId,
          pullRequestId,
          commitSha,
          status: 'COMPLETED',
          score,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      for (const pageInput of scanPages) {
        const page = await tx.scanPage.create({
          data: {
            scanId: scan.id,
            url: pageInput.url,
            title: pageInput.title,
          },
        });

        if (pageInput.violations.length > 0) {
          await tx.violation.createMany({
            data: pageInput.violations.map((v: NormalizedViolation) => ({
              scanId: scan.id,
              scanPageId: page.id,
              ruleId: v.ruleId,
              impact: SEVERITY_TO_IMPACT[v.impact] || 'MODERATE',
              description: v.description,
              helpUrl: v.helpUrl,
              htmlSnippet: v.htmlSnippet,
              targetSelector: v.targetSelector,
            })),
          });
        }
      }

      return scan;
    });

    this.logger.info({ scanId: result.id, score }, 'Saved scan result transaction');
    return result.id;
  }

  async getBaselineViolations(repositoryId: string): Promise<NormalizedViolation[]> {
    const baselineScan = await this.db.scan.findFirst({
      where: {
        repositoryId,
        status: 'COMPLETED',
      },
      orderBy: {
        completedAt: 'desc',
      },
      include: {
        violations: true,
        pages: true,
      },
    });

    if (!baselineScan) return [];

    const pageUrlMap = new Map<string, string>();
    for (const page of baselineScan.pages) {
      pageUrlMap.set(page.id, page.url);
    }

    return baselineScan.violations.map((v: (typeof baselineScan.violations)[number]) => {
      const url = (v.scanPageId && pageUrlMap.get(v.scanPageId)) || '';
      return {
        id: `${v.ruleId}:${url}:${v.targetSelector || ''}`,
        ruleId: v.ruleId,
        impact: IMPACT_TO_SEVERITY[v.impact],
        description: v.description,
        helpUrl: v.helpUrl || undefined,
        wcagCriteria: [],
        htmlSnippet: v.htmlSnippet || '',
        targetSelector: v.targetSelector || '',
        normalizedSelector: v.targetSelector || '',
        url,
      };
    });
  }
}
