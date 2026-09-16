export interface CreateCheckRunParams {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status?: 'queued' | 'in_progress' | 'completed';
  startedAt?: string;
  externalId?: string;
}

export interface UpdateCheckRunParams {
  owner: string;
  repo: string;
  checkRunId: number;
  status?: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  completedAt?: string;
  output?: {
    title: string;
    summary: string;
    text?: string;
  };
}

export interface CreateCommentParams {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

export interface UpdateCommentParams {
  owner: string;
  repo: string;
  commentId: bigint | number;
  body: string;
}

export interface GetFileContentParams {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

export interface IGitHubClient {
  createCheckRun(installationId: number, params: CreateCheckRunParams): Promise<number>;
  updateCheckRun(installationId: number, params: UpdateCheckRunParams): Promise<void>;
  createComment(installationId: number, params: CreateCommentParams): Promise<bigint>;
  updateComment(installationId: number, params: UpdateCommentParams): Promise<void>;
  getFileContent(installationId: number, params: GetFileContentParams): Promise<string | null>;
  getInstallationToken(installationId: number): Promise<string>;
}
