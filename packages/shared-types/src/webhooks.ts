import { z } from 'zod';

export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
});

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean().default(false),
  owner: GitHubUserSchema,
  html_url: z.string().optional(),
  default_branch: z.string().default('main'),
});

export const GitHubInstallationRefSchema = z.object({
  id: z.number(),
  node_id: z.string().optional(),
});

export const PullRequestObjectSchema = z.object({
  id: z.number(),
  number: z.number(),
  state: z.string(),
  title: z.string(),
  user: GitHubUserSchema,
  body: z.string().nullable().optional(),
  head: z.object({
    sha: z.string(),
    ref: z.string(),
    repo: GitHubRepositorySchema.optional(),
  }),
  base: z.object({
    sha: z.string(),
    ref: z.string(),
    repo: GitHubRepositorySchema.optional(),
  }),
});

export const PullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: PullRequestObjectSchema,
  repository: GitHubRepositorySchema,
  installation: GitHubInstallationRefSchema,
  sender: GitHubUserSchema.optional(),
});

export type PullRequestEvent = z.infer<typeof PullRequestEventSchema>;

export const DeploymentStatusObjectSchema = z.object({
  id: z.number(),
  state: z.string(),
  target_url: z.string().nullable().optional(),
  environment_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const DeploymentObjectSchema = z.object({
  id: z.number(),
  sha: z.string(),
  ref: z.string(),
  environment: z.string(),
  payload: z.record(z.unknown()).optional(),
});

export const DeploymentStatusEventSchema = z.object({
  action: z.string(),
  deployment_status: DeploymentStatusObjectSchema,
  deployment: DeploymentObjectSchema,
  repository: GitHubRepositorySchema,
  installation: GitHubInstallationRefSchema,
});

export type DeploymentStatusEvent = z.infer<typeof DeploymentStatusEventSchema>;

export const InstallationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    account: z.object({
      login: z.string(),
      id: z.number(),
      type: z.string().optional(),
    }),
  }),
  repositories: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
        private: z.boolean(),
      }),
    )
    .optional(),
});

export type InstallationEvent = z.infer<typeof InstallationEventSchema>;
