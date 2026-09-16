import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanQueue } from './scan-queue';
import { ScanJobData } from '@a11y-guard/shared-types';

const mockQueueAdd = vi.fn();
const mockGetWaitingCount = vi.fn().mockResolvedValue(1);
const mockGetActiveCount = vi.fn().mockResolvedValue(2);
const mockGetFailedCount = vi.fn().mockResolvedValue(0);
const mockGetCompletedCount = vi.fn().mockResolvedValue(5);

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockQueueAdd,
      getWaitingCount: mockGetWaitingCount,
      getActiveCount: mockGetActiveCount,
      getFailedCount: mockGetFailedCount,
      getCompletedCount: mockGetCompletedCount,
      close: vi.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({})),
  };
});

describe('ScanQueue', () => {
  let queue: ScanQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new ScanQueue({ redisUrl: 'redis://localhost:6379' });
  });

  it('enqueues job with correct jobId format and options', async () => {
    const jobData: ScanJobData = {
      correlationId: 'delivery-123',
      repositoryId: 'repo-abc',
      installationId: 42,
      prNumber: 10,
      commitSha: 'sha999',
      baseBranch: 'main',
      checkRunId: 100,
      triggerType: 'pull_request',
    };

    await queue.enqueue(jobData);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'scan',
      jobData,
      expect.objectContaining({
        jobId: 'scan:repo-abc:sha999',
        attempts: 3,
        removeOnComplete: 1000,
        removeOnFail: false,
      }),
    );
  });

  it('returns health counts correctly', async () => {
    const health = await queue.getHealth();
    expect(health).toEqual({
      waiting: 1,
      active: 2,
      failed: 0,
      completed: 5,
    });
  });
});
