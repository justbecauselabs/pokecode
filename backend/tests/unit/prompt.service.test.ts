import { describe, it, expect, beforeAll, mock, afterAll } from 'bun:test';
import { PromptService } from '@/services/prompt.service';
import { NotFoundError, ConflictError } from '@/types';

describe('PromptService', () => {
  let service: PromptService;

  beforeAll(() => {
    // Mock the database
    mock.module('@/db', () => ({
      db: {
        insert: mock(() => ({
          values: mock((data: any) => ({
            returning: mock(() => [
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
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => Promise.resolve())
          }))
        })),
        query: {
          sessions: {
            findFirst: mock((options: any) => Promise.resolve({
              id: 'test-session-id',
              projectPath: '/test/project',
              claudeDirectoryPath: '/home/.claude/projects/test-project',
              status: 'active',
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
              lastAccessedAt: new Date(),
            }))
          },
          prompts: {
            findFirst: mock(() => Promise.resolve({
              id: 'test-prompt-id',
              sessionId: 'test-session-id',
              status: 'queued',
              jobId: null,
              error: null,
              metadata: {},
              createdAt: new Date(),
              completedAt: null,
            })),
            findMany: mock(() => Promise.resolve([]))
          }
        }
      }
    }));

    // Mock queue service
    mock.module('@/services/queue.service', () => ({
      queueService: {
        addPromptJob: mock(() => Promise.resolve()),
        cancelJob: mock(() => Promise.resolve()),
      }
    }));

    // Mock Claude directory service
    mock.module('@/services/claude-directory.service', () => ({
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
    mock.restore();
  });

  describe('createPrompt', () => {
    it('should create prompt with metadata only (no content in database)', async () => {
      const result = await service.createPrompt('test-session-id', {
        prompt: 'Test prompt content',
        allowedTools: ['read', 'write'],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sessionId).toBe('test-session-id');
      expect(result.status).toBe('queued');
      // Note: prompt content is not stored in database anymore
    });

    it('should throw NotFoundError for non-existent session', async () => {
      // Override session mock to return null
      const { db } = await import('@/db');
      db.query.sessions.findFirst = mock(() => Promise.resolve(null));

      await expect(service.createPrompt('non-existent-session', {
        prompt: 'Test prompt',
      })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should throw ConflictError for inactive session', async () => {
      // Override session mock to return inactive session
      const { db } = await import('@/db');
      db.query.sessions.findFirst = mock(() => Promise.resolve({
        id: 'test-session-id',
        status: 'inactive',
        metadata: {},
      }));

      await expect(service.createPrompt('test-session-id', {
        prompt: 'Test prompt',
      })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('getHistory', () => {
    beforeAll(() => {
      // Reset session mock to active
      const { db } = require('@/db');
      db.query.sessions.findFirst = mock(() => Promise.resolve({
        id: 'test-session-id',
        projectPath: '/test/project',
        claudeDirectoryPath: '/home/.claude/projects/test-project',
        status: 'active',
        metadata: {},
      }));
    });

    it('should load history from Claude directory', async () => {
      const result = await service.getHistory('test-session-id', {});

      expect(result).toBeDefined();
      expect(result.prompts).toBeDefined();
      expect(Array.isArray(result.prompts)).toBe(true);
    });

    it('should handle Claude directory errors with fallback', async () => {
      // Mock Claude directory service to throw error
      const ClaudeDirectoryService = (await import('@/services/claude-directory.service')).default;
      ClaudeDirectoryService.prototype.getProjectConversations = mock(() => {
        throw new Error('Claude directory not available');
      });

      const result = await service.getHistory('test-session-id', {});

      expect(result).toBeDefined();
      expect(Array.isArray(result.prompts)).toBe(true);
    });

    it('should apply pagination correctly', async () => {
      const result = await service.getHistory('test-session-id', {
        limit: 10,
        offset: 5,
      });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
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
      ClaudeDirectoryService.prototype.exportSessionHistory = mock(() => {
        throw new Error('Export failed');
      });

      const result = await service.exportSession('test-session-id', 'json');

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('updatePromptResult', () => {
    it('should update prompt status and metadata (no response content)', async () => {
      // Should not throw when updating prompt result
      await expect(service.updatePromptResult('test-prompt-id', {
        status: 'completed',
        metadata: {
          duration: 1000,
          toolCallCount: 2,
          hasClaudeDirectoryContent: true,
        },
      })).resolves.not.toThrow();
    });

    it('should handle error status updates', async () => {
      await expect(service.updatePromptResult('test-prompt-id', {
        status: 'failed',
        error: 'Test error message',
        metadata: {
          errorDetails: {
            message: 'Test error',
            timestamp: new Date().toISOString(),
          },
        },
      })).resolves.not.toThrow();
    });
  });
});