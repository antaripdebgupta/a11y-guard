export type ImpactSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface NormalizedViolation {
  id: string; // Fingerprint hash/ID
  ruleId: string;
  impact: ImpactSeverity;
  description: string;
  helpUrl?: string;
  wcagCriteria: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  htmlSnippet: string;
  targetSelector: string;
  normalizedSelector: string;
  url: string;
  pageTitle?: string;
}

export interface DiffResult {
  newViolations: NormalizedViolation[];
  existingViolations: NormalizedViolation[];
  resolvedViolations: NormalizedViolation[];
  totalCurrentCount: number;
  totalBaselineCount: number;
}

export interface GateConfig {
  failOnSeverity: ImpactSeverity;
}

export interface ScanSummary {
  scanId: string;
  commitSha: string;
  repositoryFullName: string;
  prNumber?: number;
  score: number;
  baselineScore?: number;
  conclusion: 'success' | 'failure';
  diff: DiffResult;
  scannedPagesCount: number;
  durationMs: number;
  configFound: boolean;
}

export interface ScanJobData {
  correlationId: string;
  repositoryId: string;
  installationId: number;
  prNumber?: number;
  commitSha: string;
  baseBranch: string;
  previewUrl?: string;
  checkRunId: number;
  triggerType: 'pull_request' | 'push' | 'scheduled' | 'manual';
}

export interface PageScanOptions {
  timeoutMs?: number;
}

export interface RawAxeResult {
  url: string;
  pageTitle?: string;
  axeResults: unknown;
  screenshotBuffer?: Buffer | Uint8Array;
}
