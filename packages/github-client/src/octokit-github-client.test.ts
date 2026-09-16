/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OctokitGitHubClient } from './octokit-github-client';

// Mock Octokit
vi.mock('octokit', () => {
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockCreateComment = vi.fn();
  const mockUpdateComment = vi.fn();
  const mockGetContent = vi.fn();

  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        checks: {
          create: mockCreate,
          update: mockUpdate,
        },
        issues: {
          createComment: mockCreateComment,
          updateComment: mockUpdateComment,
        },
        repos: {
          getContent: mockGetContent,
        },
      },
    })),
    __mockCreate: mockCreate,
    __mockUpdate: mockUpdate,
    __mockCreateComment: mockCreateComment,
    __mockUpdateComment: mockUpdateComment,
    __mockGetContent: mockGetContent,
  };
});

import * as octokitModule from 'octokit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __mockCreate, __mockUpdate, __mockCreateComment, __mockUpdateComment, __mockGetContent } =
  octokitModule as Record<string, any>;

describe('OctokitGitHubClient', () => {
  const getInstallationToken = vi.fn().mockResolvedValue('test-token');
  const client = new OctokitGitHubClient({
    getInstallationToken,
    initialRetryDelayMs: 1,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates check run correctly', async () => {
    __mockCreate.mockResolvedValueOnce({ data: { id: 12345 } });

    const id = await client.createCheckRun(99, {
      owner: 'acme',
      repo: 'test-repo',
      name: 'a11y-guard',
      headSha: 'sha123',
      status: 'queued',
    });

    expect(id).toBe(12345);
    expect(__mockCreate).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'test-repo',
      name: 'a11y-guard',
      head_sha: 'sha123',
      status: 'queued',
      started_at: undefined,
      external_id: undefined,
    });
  });

  it('updates check run correctly', async () => {
    __mockUpdate.mockResolvedValueOnce({});

    await client.updateCheckRun(99, {
      owner: 'acme',
      repo: 'test-repo',
      checkRunId: 12345,
      status: 'completed',
      conclusion: 'success',
    });

    expect(__mockUpdate).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'test-repo',
      check_run_id: 12345,
      status: 'completed',
      conclusion: 'success',
      completed_at: undefined,
      output: undefined,
    });
  });

  it('creates and updates PR comments', async () => {
    __mockCreateComment.mockResolvedValueOnce({ data: { id: 777 } });
    __mockUpdateComment.mockResolvedValueOnce({});

    const commentId = await client.createComment(99, {
      owner: 'acme',
      repo: 'test-repo',
      issueNumber: 42,
      body: 'Report body',
    });
    expect(commentId).toBe(BigInt(777));

    await client.updateComment(99, {
      owner: 'acme',
      repo: 'test-repo',
      commentId: BigInt(777),
      body: 'Updated report body',
    });
    expect(__mockUpdateComment).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'test-repo',
      comment_id: 777,
      body: 'Updated report body',
    });
  });

  it('fetches file content and returns decoded string or null on 404', async () => {
    const encodedContent = Buffer.from('routes: []').toString('base64');
    __mockGetContent.mockResolvedValueOnce({
      data: { content: encodedContent },
    });

    const content = await client.getFileContent(99, {
      owner: 'acme',
      repo: 'test-repo',
      path: 'a11y.config.yml',
      ref: 'main',
    });
    expect(content).toBe('routes: []');

    __mockGetContent.mockRejectedValueOnce({ status: 404 });
    const nullContent = await client.getFileContent(99, {
      owner: 'acme',
      repo: 'test-repo',
      path: 'missing.yml',
      ref: 'main',
    });
    expect(nullContent).toBeNull();
  });

  it('retries transient 500 error and succeeds on retry', async () => {
    __mockCreate.mockRejectedValueOnce({ status: 500 });
    __mockCreate.mockResolvedValueOnce({ data: { id: 999 } });

    const id = await client.createCheckRun(99, {
      owner: 'acme',
      repo: 'test-repo',
      name: 'a11y-guard',
      headSha: 'sha123',
    });

    expect(id).toBe(999);
    expect(__mockCreate).toHaveBeenCalledTimes(2);
  });
});
