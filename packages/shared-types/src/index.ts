export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum ScanStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ImpactLevel {
  CRITICAL = 'CRITICAL',
  SERIOUS = 'SERIOUS',
  MODERATE = 'MODERATE',
  MINOR = 'MINOR',
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  createdAt: Date;
}

export interface Installation {
  id: string;
  organizationId: string;
  githubInstallationId: number;
  accountName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository {
  id: string;
  organizationId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PullRequest {
  id: string;
  repositoryId: string;
  prNumber: number;
  title: string;
  headSha: string;
  baseSha: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scan {
  id: string;
  repositoryId: string;
  pullRequestId: string | null;
  commitSha: string;
  status: ScanStatus;
  score: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ScanPage {
  id: string;
  scanId: string;
  url: string;
  title: string | null;
  createdAt: Date;
}

export interface Violation {
  id: string;
  scanId: string;
  scanPageId: string | null;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  helpUrl: string | null;
  htmlSnippet: string | null;
  targetSelector: string | null;
  createdAt: Date;
}

export interface CustomRule {
  id: string;
  organizationId: string;
  code: string;
  description: string;
  isEnabled: boolean;
  createdAt: Date;
}

export interface Integration {
  id: string;
  organizationId: string;
  type: string;
  config: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// API DTOs
export interface HealthStatusDto {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services?: {
    database: boolean;
    redis: boolean;
  };
}

export interface ViolationDto {
  id: string;
  ruleId: string;
  impact: ImpactLevel;
  description: string;
  helpUrl?: string;
  htmlSnippet?: string;
  targetSelector?: string;
}

export interface ScanResponseDto {
  id: string;
  repositoryId: string;
  commitSha: string;
  status: ScanStatus;
  score: number | null;
  violationsCount: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export * from './violations';
export * from './webhooks';
