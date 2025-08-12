import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ClaudeCodeWorker } from '@/workers/claude-code.worker';
import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';
import { createTestSession, getTestDatabase, initTestDatabase, cleanupTestDatabase } from '../helpers/database.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from '../helpers/claude-directory.mock';
import * as schema from '@/db/schema';
import type { PromptJobData } from '@/types';

// Mock external dependencies
vi.mock('bullmq');
vi.mock('ioredis');
vi.mock('@/services/claude-code-sdk.service');
vi.mock('@/services/prompt.service');

describe('ClaudeCodeWorker', () => {
  let worker: ClaudeCodeWorker;
  let mockRedis: any;
  let mockSDKService: any;
  let mockClaudeService: ReturnType<typeof createMockClaudeDirectoryService>;
  let testSession: typeof schema.sessions.$inferSelect;

  beforeAll(async () => {
    await initTestDatabase();
    
    // Set up mocks
    mockClaudeService = createMockClaudeDirectoryService();
    mockClaudeDirectoryModule(mockClaudeService);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Create test session
    testSession = await createTestSession({
      projectPath: '/test/project',
      claudeDirectoryPath: '/test/claude/session',
      claudeCodeSessionId: 'claude-session-123',
    });

    // Mock Redis
    mockRedis = {
      publish: vi.fn(),
      quit: vi.fn(),
    };
    vi.mocked(Redis).mockImplementation(() => mockRedis);

    // Mock ClaudeCodeSDKService
    mockSDKService = {
      execute: vi.fn(),
      abort: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    vi.mocked(ClaudeCodeSDKService).mockImplementation(() => mockSDKService);

    // Mock prompt service
    vi.doMock('@/services/prompt.service', () => ({
      promptService: {
        updatePromptResult: vi.fn(),
      },
    }));

    // Create worker instance
    worker = new ClaudeCodeWorker();
  });

  afterEach(async () => {
    if (worker) {
      await worker.shutdown();
    }
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create worker with correct configuration', () => {
      expect(Redis).toHaveBeenCalledWith(expect.any(String));
      expect(worker).toBeDefined();
    });

    it('should set up event handlers', () => {
      const metrics = worker.getMetrics();
      expect(metrics).toMatchObject({
        concurrency: 5,
        activeSessions: 0,
      });
    });
  });

  describe('processPrompt', () => {
    let mockJob: Partial<Job<PromptJobData>>;
    let jobData: PromptJobData;

    beforeEach(() => {
      jobData = {
        sessionId: testSession.id,
        promptId: 'prompt-123',
        prompt: 'Test prompt',
        allowedTools: ['read', 'write'],
        projectPath: testSession.projectPath,
      };

      mockJob = {
        id: 'job-123',
        data: jobData,
        updateProgress: vi.fn(),
      };

      mockSDKService.execute.mockResolvedValue({
        success: true,
        response: 'Test response',
        duration: 1500,
        toolCallCount: 2,
        messages: [
          {
            type: 'assistant',
            content: 'Test response',
          },
          {
            type: 'tool_use',
            name: 'read',
            input: { file: 'test.txt' },
          },
        ],
        stopReason: 'end_turn',
        totalTokens: 150,
      });
    });

    it('should process prompt successfully', async () => {
      // Access the private processPrompt method via reflection
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await expect(processPrompt(mockJob)).resolves.not.toThrow();

      expect(ClaudeCodeSDKService).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        claudeCodeSessionId: testSession.claudeCodeSessionId,
      });

      expect(mockSDKService.execute).toHaveBeenCalledWith(jobData.prompt);
    });

    it('should update session working state during processing', async () => {
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await processPrompt(mockJob);

      // Check database updates
      const db = getTestDatabase();
      const updatedSession = await db.query.sessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, testSession.id),
      });

      expect(updatedSession?.isWorking).toBe(false); // Should be false after completion
      expect(updatedSession?.lastJobStatus).toBe('completed');
    });

    it('should handle SDK service failures', async () => {
      mockSDKService.execute.mockResolvedValue({
        success: false,
        error: 'SDK execution failed',
      });

      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await expect(processPrompt(mockJob)).rejects.toThrow('SDK execution failed');

      // Check that session state is updated to failed
      const db = getTestDatabase();
      const updatedSession = await db.query.sessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, testSession.id),
      });

      expect(updatedSession?.isWorking).toBe(false);
      expect(updatedSession?.lastJobStatus).toBe('failed');
    });

    it('should handle exceptions during processing', async () => {
      mockSDKService.execute.mockRejectedValue(new Error('Unexpected error'));

      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await expect(processPrompt(mockJob)).rejects.toThrow('Unexpected error');

      // Verify error handling
      const { promptService } = await import('@/services/prompt.service');
      expect(promptService.updatePromptResult).toHaveBeenCalledWith(
        jobData.promptId,
        expect.objectContaining({
          error: 'Unexpected error',
          status: 'failed',
        })
      );
    });

    it('should publish start and completion events', async () => {
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await processPrompt(mockJob);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `claude-code:${testSession.id}:${jobData.promptId}`,
        expect.stringContaining('"type":"message"')
      );

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `claude-code:${testSession.id}:${jobData.promptId}`,
        expect.stringContaining('"type":"complete"')
      );
    });

    it('should track active sessions', async () => {
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      // Mock execute to be long-running so we can check active sessions
      let executeResolve: () => void;
      mockSDKService.execute.mockReturnValue(
        new Promise<any>((resolve) => {
          executeResolve = () => resolve({
            success: true,
            response: 'Test response',
            duration: 1000,
            toolCallCount: 0,
            messages: [],
          });
        })
      );

      // Start processing (don't await yet)
      const processPromise = processPrompt(mockJob);

      // Give it a moment to register the active session
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check active sessions
      const metrics = await worker.getMetrics();
      expect(metrics.activeSessions).toBe(1);

      // Complete the execution
      executeResolve!();
      await processPromise;

      // Check active sessions cleared
      const finalMetrics = await worker.getMetrics();
      expect(finalMetrics.activeSessions).toBe(0);
    });
  });

  describe('Event Forwarding', () => {
    let mockJob: Partial<Job<PromptJobData>>;
    let eventHandlers: Record<string, Function>;

    beforeEach(() => {
      mockJob = {
        id: 'job-123',
        data: {
          sessionId: testSession.id,
          promptId: 'prompt-123',
          prompt: 'Test prompt',
          projectPath: testSession.projectPath,
        },
        updateProgress: vi.fn(),
      };

      eventHandlers = {};
      mockSDKService.on.mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      });

      mockSDKService.execute.mockResolvedValue({
        success: true,
        response: 'Test',
        duration: 1000,
        toolCallCount: 0,
        messages: [],
      });
    });

    it('should forward streaming events to Redis', async () => {
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await processPrompt(mockJob);

      // Simulate events
      const textDeltaHandler = eventHandlers['text_delta'];
      expect(textDeltaHandler).toBeDefined();

      await textDeltaHandler({ delta: 'Hello' });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `claude-code:${testSession.id}:prompt-123`,
        expect.stringContaining('"type":"text_delta"')
      );
    });

    it('should forward tool use events and update job progress', async () => {
      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await processPrompt(mockJob);

      const toolUseHandler = eventHandlers['tool_use'];
      expect(toolUseHandler).toBeDefined();

      await toolUseHandler({ tool: 'read', params: { file: 'test.txt' } });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `claude-code:${testSession.id}:prompt-123`,
        expect.stringContaining('"type":"tool_use"')
      );

      expect(mockJob.updateProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallCount: 1,
        })
      );
    });

    it('should handle event publishing errors gracefully', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Redis error'));

      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      // Should not throw even if Redis publish fails
      await expect(processPrompt(mockJob)).resolves.not.toThrow();
    });
  });

  describe('Session ID Backfill', () => {
    it('should backfill Claude Code session ID when captured', async () => {
      const mockJob = {
        id: 'job-123',
        data: {
          sessionId: testSession.id,
          promptId: 'prompt-123',
          prompt: 'Test prompt',
          projectPath: testSession.projectPath,
        },
        updateProgress: vi.fn(),
      };

      mockSDKService.execute.mockResolvedValue({
        success: true,
        response: 'Test',
        duration: 1000,
        toolCallCount: 0,
        messages: [],
      });

      let claudeSessionHandler: Function;
      mockSDKService.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'claude_session_captured') {
          claudeSessionHandler = handler;
        }
      });

      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await processPrompt(mockJob);

      // Simulate session capture event
      expect(claudeSessionHandler).toBeDefined();
      await claudeSessionHandler({
        databaseSessionId: testSession.id,
        claudeCodeSessionId: 'new-claude-session-456',
      });

      // Check database update
      const db = getTestDatabase();
      const updatedSession = await db.query.sessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, testSession.id),
      });

      expect(updatedSession?.claudeCodeSessionId).toBe('new-claude-session-456');
    });
  });

  describe('Safe JSON Stringify', () => {
    it('should handle circular references', () => {
      const safeJsonStringify = (worker as any).safeJsonStringify.bind(worker);
      
      const circular: any = { name: 'test' };
      circular.self = circular;

      const result = safeJsonStringify(circular);
      expect(result).toContain('[Circular]');
    });

    it('should truncate large strings', () => {
      const safeJsonStringify = (worker as any).safeJsonStringify.bind(worker);
      
      const largeString = 'x'.repeat(15000);
      const obj = { data: largeString };

      const result = safeJsonStringify(obj);
      expect(result).toContain('[truncated]');
    });

    it('should handle objects that are too large', () => {
      const safeJsonStringify = (worker as any).safeJsonStringify.bind(worker);
      
      const largeObj = {
        type: 'test',
        data: 'x'.repeat(200000),
      };

      const result = safeJsonStringify(largeObj, 1000);
      expect(result).toContain('[truncated]');
    });

    it('should handle stringify errors gracefully', () => {
      const safeJsonStringify = (worker as any).safeJsonStringify.bind(worker);
      
      // Create an object that will cause JSON.stringify to fail
      const problematicObj = {
        toJSON() {
          throw new Error('Stringify error');
        }
      };

      const result = safeJsonStringify(problematicObj);
      expect(result).toContain('Failed to serialize message');
    });
  });

  describe('Worker Lifecycle', () => {
    it('should start worker successfully', async () => {
      const mockWorker = {
        isRunning: vi.fn(() => false),
        run: vi.fn(),
      };

      // Override the worker instance
      (worker as any).worker = mockWorker;

      await worker.start();

      expect(mockWorker.run).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      const mockWorker = {
        isRunning: vi.fn(() => true),
        run: vi.fn(),
      };

      (worker as any).worker = mockWorker;

      await worker.start();

      expect(mockWorker.run).not.toHaveBeenCalled();
    });

    it('should shutdown gracefully', async () => {
      const mockWorker = {
        close: vi.fn(),
      };

      (worker as any).worker = mockWorker;

      await worker.shutdown();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should abort active sessions during shutdown', async () => {
      // Add active session
      const activeSessions = new Map();
      activeSessions.set('prompt-123', mockSDKService);
      (worker as any).activeSessions = activeSessions;

      const mockWorker = {
        close: vi.fn(),
      };
      (worker as any).worker = mockWorker;

      await worker.shutdown();

      expect(mockSDKService.abort).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should return worker metrics', async () => {
      const mockWorker = {
        isRunning: vi.fn(() => true),
        isPaused: vi.fn(() => false),
      };

      (worker as any).worker = mockWorker;

      const metrics = await worker.getMetrics();

      expect(metrics).toMatchObject({
        isRunning: true,
        isPaused: false,
        concurrency: 5,
        activeSessions: 0,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      vi.doMock('@/db', () => ({
        db: {
          query: {
            sessions: {
              findFirst: vi.fn(() => Promise.reject(new Error('Database error'))),
            },
          },
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn(() => Promise.reject(new Error('Database error'))),
            })),
          })),
        },
      }));

      const mockJob = {
        id: 'job-123',
        data: {
          sessionId: testSession.id,
          promptId: 'prompt-123',
          prompt: 'Test prompt',
          projectPath: testSession.projectPath,
        },
        updateProgress: vi.fn(),
      };

      const processPrompt = (worker as any).processPrompt.bind(worker);
      
      await expect(processPrompt(mockJob)).rejects.toThrow('Database error');
    });

    it('should handle Redis publishing errors', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Redis connection lost'));

      const publishEvent = (worker as any).publishEvent.bind(worker);
      
      // Should not throw
      await expect(publishEvent('test-channel', { type: 'test' })).resolves.not.toThrow();
    });
  });

  describe('Event Handler Setup', () => {
    it('should set up all required event handlers', () => {
      const mockWorkerInstance = {
        on: vi.fn(),
        isRunning: vi.fn(() => false),
        run: vi.fn(),
        close: vi.fn(),
        isPaused: vi.fn(() => false),
      };

      // Override Worker constructor to capture event handlers
      vi.mocked(require('bullmq').Worker).mockImplementation(() => mockWorkerInstance);

      new ClaudeCodeWorker();

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('progress', expect.any(Function));
    });
  });
});