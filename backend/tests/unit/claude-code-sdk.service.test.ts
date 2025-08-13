import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';

// Mock file system access before importing the service
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    constants: { F_OK: 0 },
    promises: {
      access: vi.fn().mockResolvedValue(undefined),
    },
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
    }),
  };
});

// Mock the Claude Code SDK
vi.mock('@anthropic-ai/claude-code', () => ({
  query: vi.fn(),
}));

import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';

describe('ClaudeCodeSDKService', () => {
  let service: ClaudeCodeSDKService;

  beforeAll(async () => {
    // Set required environment variable
    process.env.CLAUDE_CODE_PATH = '/mock/path/to/claude-code';

    // Import the mocked function
    const { query } = await import('@anthropic-ai/claude-code');
    
    // Setup default mock implementation
    vi.mocked(query).mockImplementation(({ prompt, options }: any) => ({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'system',
          model: 'claude-3-5-sonnet-20241022',
          tools: ['bash', 'str_replace', 'read'],
        };
        yield {
          type: 'assistant',
          message: {
            content: [{
              type: 'text',
              text: 'Test response from Claude Code',
            }],
          },
        };
        yield {
          type: 'result',
          subtype: 'success',
          result: 'Success',
          usage: { input_tokens: 100, output_tokens: 50 },
          total_cost_usd: 0.001,
        };
      },
    }));

    const mockMessageService = {
      saveSDKMessage: vi.fn(),
      saveUserMessage: vi.fn(),
    };
    
    service = new ClaudeCodeSDKService({
      sessionId: 'db-session-id',
      projectPath: '/test/project',
      messageService: mockMessageService as any,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
    delete process.env.CLAUDE_CODE_PATH;
  });

  describe('Basic Functionality', () => {
    it('should execute prompts correctly', async () => {
      // Override the query mock to capture options
      let capturedOptions: any;
      const { query } = await import('@anthropic-ai/claude-code');
      
      vi.mocked(query).mockImplementation(({ prompt, options }: any) => {
        capturedOptions = options;
        return {
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'system',
              model: 'claude-3-5-sonnet-20241022',
              tools: ['bash'],
            };
            yield {
              type: 'assistant',
              message: {
                content: [{
                  type: 'text',
                  text: 'Test response',
                }],
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              result: 'Success',
              usage: { input_tokens: 50, output_tokens: 25 },
              total_cost_usd: 0.0005,
            };
          },
        };
      });

      const result = await service.execute('Test prompt');

      expect(result.success).toBe(true);
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.cwd).toBe('/test/project');
      expect(capturedOptions.permissionMode).toBe('bypassPermissions');
      expect(capturedOptions.resume).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK errors gracefully', async () => {
      // Add error event listener to handle unhandled error events
      service.on('error', () => {
        // Handle the error event to prevent unhandled error
      });

      const { query } = await import('@anthropic-ai/claude-code');
      (query as any).mockImplementation(() => {
        throw new Error('Mock SDK error');
      });

      const result = await service.execute('Test prompt that will fail');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mock SDK error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should prevent concurrent executions', async () => {
      const { query } = await import('@anthropic-ai/claude-code');
      (query as any).mockImplementation(() => ({
        async *[Symbol.asyncIterator]() {
          // Simulate slow response
          await new Promise(resolve => setTimeout(resolve, 100));
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Success',
          };
        },
      }));

      // Start first execution
      const promise1 = service.execute('First prompt');
      
      // Try to start second execution immediately
      await expect(service.execute('Second prompt')).rejects.toThrow(
        'Already processing a prompt'
      );

      // Wait for first to complete
      const result1 = await promise1;
      expect(result1.success).toBe(true);

      // Now second execution should work
      const result2 = await service.execute('Second prompt');
      expect(result2.success).toBe(true);
    });
  });

  describe('Message Processing', () => {
    it('should process assistant messages and count tool uses', async () => {
      const { query } = await import('@anthropic-ai/claude-code');
      (query as any).mockImplementation(() => ({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'I will help you with that task.',
                },
                {
                  type: 'tool_use',
                  name: 'bash',
                  input: { command: 'ls -la' },
                },
                {
                  type: 'tool_use',
                  name: 'read',
                  input: { file: 'package.json' },
                },
              ],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Success',
            usage: { input_tokens: 100, output_tokens: 50 },
            total_cost_usd: 0.001,
          };
        },
      }));

      const result = await service.execute('Test prompt with tool uses');

      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(2);
      expect(result.response).toBe('I will help you with that task.');
      expect(result.totalTokens).toBe(0); // totalTokens initialized to 0 in streaming state
    });

    it('should emit events during processing', async () => {
      const events: any[] = [];
      
      service.on('system', (event) => events.push({ type: 'system', event }));
      service.on('assistant', (event) => events.push({ type: 'assistant', event }));
      service.on('tool_use', (event) => events.push({ type: 'tool_use', event }));
      service.on('result', (event) => events.push({ type: 'result', event }));

      const { query } = await import('@anthropic-ai/claude-code');
      (query as any).mockImplementation(() => ({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'system',
            model: 'claude-3-5-sonnet-20241022',
            tools: ['bash', 'read'],
          };
          yield {
            type: 'assistant',
            message: {
              content: [{
                type: 'text',
                text: 'Event test response',
              }, {
                type: 'tool_use',
                name: 'bash',
                input: { command: 'echo test' },
              }],
            },
          };
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Success',
            usage: { input_tokens: 75, output_tokens: 30 },
            total_cost_usd: 0.0008,
          };
        },
      }));

      const result = await service.execute('Test events');

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      const systemEvent = events.find(e => e.type === 'system');
      expect(systemEvent).toBeDefined();
      expect(systemEvent.event.model).toBe('claude-3-5-sonnet-20241022');

      const assistantEvent = events.find(e => e.type === 'assistant');
      expect(assistantEvent).toBeDefined();
      expect(assistantEvent.event.content).toBe('Event test response');

      const toolUseEvent = events.find(e => e.type === 'tool_use');
      expect(toolUseEvent).toBeDefined();
      expect(toolUseEvent.event.tool).toBe('bash');

      const resultEvent = events.find(e => e.type === 'result');
      expect(resultEvent).toBeDefined();
      expect(resultEvent.event.success).toBe(true);
    });
  });

  describe('Abort Functionality', () => {
    it('should support aborting execution', async () => {
      let interruptCalled = false;
      
      const { query } = await import('@anthropic-ai/claude-code');
      (query as any).mockImplementation(() => ({
        interrupt: vi.fn(() => {
          interruptCalled = true;
          return Promise.resolve();
        }),
        async *[Symbol.asyncIterator]() {
          // Simulate long-running operation
          await new Promise(resolve => setTimeout(resolve, 200));
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Success',
          };
        },
      }));

      // Start execution
      const executePromise = service.execute('Long running prompt');
      
      // Abort after a short delay
      setTimeout(() => service.abort(), 50);

      const result = await executePromise;

      expect(interruptCalled).toBe(true);
      expect(service.isRunning()).toBe(false);
    });
  });
});