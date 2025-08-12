import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import { PromptService } from '@/services/prompt.service';
import { NotFoundError, ConflictError } from '@/types';

describe('PromptService', () => {
  let service: PromptService;

  beforeAll(() => {
    // Mock the database
    vi.doMock('@/db', () => ({
      db: {
        insert: vi.fn(() => ({
          values: vi.fn((data: any) => ({
            returning: vi.fn(() => [
              {
                id: 'test-prompt-id',
                sessionId: data.sessionId,
                status: data.status || 'queued',
                jobId: null,
                error: null,
                metadata: data.metadata,
                createdAt: new Date(),
                completedAt: null,
              }
            ])
          }))
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve())
          }))
        })),
        query: {
          sessions: {
            findFirst: vi.fn((options: any) => Promise.resolve({
              id: 'test-session-id',
              projectPath: '/test/project',
              claudeDirectoryPath: '/home/.claude/projects/test-project',
              status: 'active',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
              lastAccessedAt: new Date(),
              isWorking: false,
              currentJobId: null,
              lastJobStatus: null,
            }))
          },
          prompts: {
            findFirst: vi.fn(() => Promise.resolve({
              id: 'test-prompt-id',
              sessionId: 'test-session-id',
              status: 'queued',
              jobId: null,
              error: null,
              metadata: {},
              createdAt: new Date(),
              completedAt: null,
            })),
            findMany: vi.fn(() => Promise.resolve([]))
          }
        }
      }
    }));

    // Mock queue service
    vi.doMock('@/services/queue.service', () => ({
      queueService: {
        addPromptJob: vi.fn(() => Promise.resolve()),
        cancelJob: vi.fn(() => Promise.resolve()),
      }
    }));

    // Mock Claude directory service
    vi.doMock('@/services/claude-directory.service', () => ({
      default: class MockClaudeDirectoryService {
        getProjectConversations() {
          return {
            jsonlConversations: [
              {
                file: '/mock/path/conversation.jsonl',
                messages: [
                  {
                    role: 'user',
                    content: 'Test prompt',
                    timestamp: '2025-01-01T00:00:00Z',
                  },
                  {
                    role: 'assistant', 
                    content: 'Test response',
                    timestamp: '2025-01-01T00:00:01Z',
                  }
                ]
              }
            ]
          };
        }

        readConversationFile() {
          return [
            {
              role: 'user',
              content: 'Test prompt',
              timestamp: '2025-01-01T00:00:00Z',
            },
            {
              role: 'assistant',
              content: 'Test response', 
              timestamp: '2025-01-01T00:00:01Z',
            }
          ];
        }
      }
    }));

    service = new PromptService();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('createPrompt', () => {
    it('should create prompt with metadata only (no content in database)', async () => {
      const result = await service.createPrompt('test-session-id', {
        prompt: 'Test prompt content',
        allowedTools: ['read', 'write'],
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Prompt queued successfully');
      expect(result.jobId).toBeDefined();
      // Note: prompt content is not stored in database anymore
    });

    it('should throw NotFoundError for non-existent session', async () => {
      // Override session mock to return null
      const { db } = await import('@/db');
      db.query.sessions.findFirst = vi.fn(() => Promise.resolve(null));

      await expect(service.createPrompt('non-existent-session', {
        prompt: 'Test prompt',
      })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should allow prompt creation for inactive session', async () => {
      // Override session mock to return inactive session
      const { db } = await import('@/db');
      db.query.sessions.findFirst = vi.fn(() => Promise.resolve({
        id: 'test-session-id',
        status: 'inactive',
        metadata: {},
        isWorking: false,
        currentJobId: null,
        lastJobStatus: null,
      }));

      const result = await service.createPrompt('test-session-id', {
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Prompt queued successfully');
    });
  });


  describe('exportSession', () => {
    it('should export session with Claude directory data', async () => {
      const result = await service.exportSession('test-session-id', 'json');

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.format).toBe('json');
    });

    it('should export session in markdown format', async () => {
      const result = await service.exportSession('test-session-id', 'markdown');

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.format).toBe('markdown');
    });

    it('should handle export errors with fallback', async () => {
      // Mock Claude directory service to throw error
      const ClaudeDirectoryService = (await import('@/services/claude-directory.service')).default;
      ClaudeDirectoryService.prototype.exportSessionHistory = vi.fn(() => {
        throw new Error('Export failed');
      });

      const result = await service.exportSession('test-session-id', 'json');

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('updatePromptResult', () => {
    it('should update prompt status and metadata (no response content)', async () => {
      // Should return success for backward compatibility
      const result = await service.updatePromptResult('test-prompt-id', {
        status: 'completed',
        metadata: {
          duration: 1000,
          toolCallCount: 2,
          hasClaudeDirectoryContent: true,
        },
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle error status updates', async () => {
      const result = await service.updatePromptResult('test-prompt-id', {
        status: 'failed',
        error: 'Test error message',
        metadata: {
          errorDetails: {
            message: 'Test error',
            timestamp: new Date().toISOString(),
          },
        },
      });
      
      expect(result.success).toBe(true);
    });
  });
});