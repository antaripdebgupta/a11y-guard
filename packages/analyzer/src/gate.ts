import type { DiffResult, GateConfig, ImpactSeverity } from '@a11y-guard/shared-types';

const SEVERITY_RANK: Record<ImpactSeverity, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

export interface GateEvaluationResult {
  conclusion: 'success' | 'failure';
  summary: string;
  failingViolations: number;
}

export function computeCheckConclusion(
  diff: DiffResult,
  gateConfig: GateConfig,
): GateEvaluationResult {
  const thresholdRank = SEVERITY_RANK[gateConfig.failOnSeverity] ?? SEVERITY_RANK.serious;

  const failingNewViolations = diff.newViolations.filter(
    (v) => (SEVERITY_RANK[v.impact] ?? 1) >= thresholdRank,
  );

  if (failingNewViolations.length > 0) {
    return {
      conclusion: 'failure',
      summary: `Failed quality gate: ${failingNewViolations.length} new violation(s) with severity >= '${gateConfig.failOnSeverity}' detected.`,
      failingViolations: failingNewViolations.length,
    };
  }

  return {
    conclusion: 'success',
    summary: `Passed quality gate: No new violations matching severity threshold '${gateConfig.failOnSeverity}'.`,
    failingViolations: 0,
  };
}
