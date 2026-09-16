import type { NormalizedViolation, ImpactSeverity } from '@a11y-guard/shared-types';

const SEVERITY_WEIGHTS: Record<ImpactSeverity, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 0.5,
};

export function computeScore(violations: NormalizedViolation[]): number {
  let totalDeduction = 0;

  for (const v of violations) {
    const weight = SEVERITY_WEIGHTS[v.impact] ?? 2;
    totalDeduction += weight;
  }

  const score = Math.max(0, 100 - totalDeduction);
  return Math.round(score * 10) / 10;
}
