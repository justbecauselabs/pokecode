import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueService } from '@/services/queue.service';
import { createTestSession } from '../helpers/database.helpers';
import * as schema from '@/db/schema';

// Mock BullMQ and Redis
vi.mock('bullmq');
vi.mock('ioredis');

describe('QueueService', () => {
  let queueService: QueueService;
  let mockQueue: any;
  let mockRedis: any;
  let mockSession: typeof schema.sessions.$inferSelect;

  beforeEach(async () => {
    // Create mock queue
    mockQueue = {
      add: vi.fn(),
      getJob: vi.fn(),
      getWaitingCount: vi.fn(),
      getActiveCount: vi.fn(),
      getCompletedCount: vi.fn(),
      getFailedCount: vi.fn(),
      getDelayedCount: vi.fn(),
      close: vi.fn(),
    };

    // Create mock Redis client
    mockRedis = {
      publish: vi.fn(),
      quit: vi.fn(),
    };

    // Mock constructors
    vi.mocked(Queue).mockImplementation(() => mockQueue);
    vi.mocked(Redis).mockImplementation(() => mockRedis);

    // Create test session
    mockSession = await createTestSession({
      projectPath: '/test/project',
    });

    queueService = new QueueService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize queue and redis connections', () => {
      expect(Queue).toHaveBeenCalledWith('claude-code-jobs', expect.objectContaining({
        connection: expect.any(Object),
        defaultJobOptions: expect.objectContaining({
          removeOnComplete: expect.objectContaining({
            age: 24 * 3600,
            count: 100,
          }),
          removeOnFail: expect.objectContaining({
            age: 7 * 24 * 3600,
          }),
        }),
      }));
    });
  });

  describe('addPromptJob', () => {
    beforeEach(() => {
      mockQueue.add.mockResolvedValue({ id: 'job-123' });
    });

    it('should add a prompt job to the queue', async () => {
      const jobId = await queueService.addPromptJob(
        mockSession.id,
        'prompt-123',
        'Test prompt',
        ['read', 'write']
      );

      expect(jobId).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-prompt',
        {
          sessionId: mockSession.id,
          promptId: 'prompt-123',
          prompt: 'Test prompt',
          allowedTools: ['read', 'write'],
          projectPath: mockSession.projectPath,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );
    });

    it('should add job without allowed tools', async () => {
      await queueService.addPromptJob(mockSession.id, 'prompt-123', 'Test prompt');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-prompt',
        expect.objectContaining({
          sessionId: mockSession.id,
          promptId: 'prompt-123',
          prompt: 'Test prompt',
          allowedTools: undefined,
        }),
        expect.any(Object)
      );
    });

    it('should throw error if session not found', async () => {
      await expect(
        queueService.addPromptJob('non-existent-session', 'prompt-123', 'Test prompt')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('cancelJob', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        sessionId: 'session-123',
        promptId: 'prompt-123',
      },
      remove: vi.fn(),
    };

    beforeEach(() => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.remove.mockResolvedValue(undefined);
      mockRedis.publish.mockResolvedValue(1);
    });

    it('should cancel a job and publish completion event', async () => {
      await queueService.cancelJob('job-123', 'prompt-123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(mockJob.remove).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'claude-code:session-123:prompt-123',
        expect.stringContaining('"type":"complete"')
      );
    });

    it('should handle non-existent job gracefully', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(
        queueService.cancelJob('non-existent-job', 'prompt-123')
      ).resolves.not.toThrow();

      expect(mockJob.remove).not.toHaveBeenCalled();
    });
  });

  describe('publishEvent', () => {
    beforeEach(() => {
      mockRedis.publish.mockResolvedValue(1);
    });

    it('should publish event to Redis channel', async () => {
      const event = {
        type: 'progress',
        data: { message: 'Processing...' },
      };

      await queueService.publishEvent('session-123', 'prompt-123', event);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'claude-code:session-123:prompt-123',
        JSON.stringify(event)
      );
    });
  });

  describe('getJobStatus', () => {
    const mockJob = {
      id: 'job-123',
      getState: vi.fn(),
      progress: 50,
      data: { sessionId: 'session-123' },
      attemptsMade: 1,
      finishedOn: new Date(),
      failedReason: null,
    };

    beforeEach(() => {
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockJob.getState.mockResolvedValue('active');
    });

    it('should return job status', async () => {
      const status = await queueService.getJobStatus('job-123');

      expect(status).toEqual({
        id: 'job-123',
        state: 'active',
        progress: 50,
        data: { sessionId: 'session-123' },
        attemptsMade: 1,
        finishedOn: mockJob.finishedOn,
        failedReason: null,
      });
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const status = await queueService.getJobStatus('non-existent-job');
      expect(status).toBeNull();
    });
  });

  describe('getQueueMetrics', () => {
    beforeEach(() => {
      mockQueue.getWaitingCount.mockResolvedValue(5);
      mockQueue.getActiveCount.mockResolvedValue(2);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(3);
      mockQueue.getDelayedCount.mockResolvedValue(1);
    });

    it('should return queue metrics', async () => {
      const metrics = await queueService.getQueueMetrics();

      expect(metrics).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
        total: 8, // waiting + active + delayed
      });
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      mockQueue.close.mockResolvedValue(undefined);
      mockRedis.quit.mockResolvedValue('OK');
    });

    it('should cleanup queue and redis connections', async () => {
      await queueService.cleanup();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle queue operation errors', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        queueService.addPromptJob(mockSession.id, 'prompt-123', 'Test prompt')
      ).rejects.toThrow('Queue error');
    });

    it('should handle Redis operation errors', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Redis error'));

      await expect(
        queueService.publishEvent('session-123', 'prompt-123', { type: 'test' })
      ).rejects.toThrow('Redis error');
    });
  });

  describe('job retry configuration', () => {
    it('should configure job retries correctly', async () => {
      await queueService.addPromptJob(mockSession.id, 'prompt-123', 'Test prompt');

      const jobOptions = mockQueue.add.mock.calls[0][2];
      expect(jobOptions.attempts).toBe(3);
      expect(jobOptions.backoff).toEqual({
        type: 'exponential',
        delay: 2000,
      });
    });
  });

  describe('event publishing format', () => {
    it('should publish cancellation event with correct format', async () => {
      const mockJob = {
        id: 'job-123',
        data: { sessionId: 'session-123' },
        remove: vi.fn(),
      };
      
      mockQueue.getJob.mockResolvedValue(mockJob);
      mockRedis.publish.mockResolvedValue(1);

      await queueService.cancelJob('job-123', 'prompt-123');

      const publishCall = mockRedis.publish.mock.calls[0];
      const eventData = JSON.parse(publishCall[1]);

      expect(eventData).toMatchObject({
        type: 'complete',
        data: {
          type: 'complete',
          summary: {
            duration: 0,
            toolCallCount: 0,
          },
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('integration with database', () => {
    it('should retrieve project path from database', async () => {
      // This is implicitly tested in addPromptJob since it needs the session's projectPath
      const jobId = await queueService.addPromptJob(
        mockSession.id,
        'prompt-123',
        'Test prompt'
      );

      expect(jobId).toBeDefined();
      
      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.projectPath).toBe(mockSession.projectPath);
    });
  });
});