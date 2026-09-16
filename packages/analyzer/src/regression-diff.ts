import type { NormalizedViolation, DiffResult } from '@a11y-guard/shared-types';

export function diffViolations(
  baselineViolations: NormalizedViolation[] = [],
  currentViolations: NormalizedViolation[] = [],
): DiffResult {
  const baselineMap = new Map<string, NormalizedViolation>();
  for (const v of baselineViolations) {
    baselineMap.set(v.id, v);
  }

  const currentMap = new Map<string, NormalizedViolation>();
  for (const v of currentViolations) {
    currentMap.set(v.id, v);
  }

  const newViolations: NormalizedViolation[] = [];
  const existingViolations: NormalizedViolation[] = [];
  const resolvedViolations: NormalizedViolation[] = [];

  for (const v of currentViolations) {
    if (baselineMap.has(v.id)) {
      existingViolations.push(v);
    } else {
      newViolations.push(v);
    }
  }

  for (const v of baselineViolations) {
    if (!currentMap.has(v.id)) {
      resolvedViolations.push(v);
    }
  }

  return {
    newViolations,
    existingViolations,
    resolvedViolations,
    totalCurrentCount: currentViolations.length,
    totalBaselineCount: baselineViolations.length,
  };
}
