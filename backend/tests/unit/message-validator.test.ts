import { describe, it, expect } from 'vitest';
import { MessageValidator } from '../../src/utils/message-validator';

describe('MessageValidator', () => {
  describe('parseJsonlMessage', () => {
    it('should successfully parse a valid user message', () => {
      const validUserMessage = {
        uuid: '12345-abcde',
        parentUuid: null,
        sessionId: 'session-123',
        timestamp: '2023-10-01T10:00:00.000Z',
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, world!',
        },
        isSidechain: false,
        userType: 'external',
        cwd: '/Users/test/project',
        version: '1.0.73',
        gitBranch: 'main',
      };

      const result = MessageValidator.parseJsonlMessage(validUserMessage, 0, '/test/file.jsonl');

      expect(result.type).toBe('user');
      expect(result.uuid).toBe('12345-abcde');
      expect(result.message.content).toBe('Hello, world!');
    });

    it('should successfully parse a valid assistant message', () => {
      const validAssistantMessage = {
        uuid: '67890-fghij',
        parentUuid: '12345-abcde',
        sessionId: 'session-123',
        timestamp: '2023-10-01T10:01:00.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Hello! How can I help you today?',
            },
          ],
          id: 'msg_123',
          type: 'message',
          model: 'claude-sonnet-4-20250514',
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 0,
            output_tokens: 15,
            service_tier: 'standard',
          },
        },
        requestId: 'req_456',
        isSidechain: false,
        userType: 'external',
        cwd: '/Users/test/project',
        version: '1.0.73',
        gitBranch: 'main',
      };

      const result = MessageValidator.parseJsonlMessage(validAssistantMessage, 1, '/test/file.jsonl');

      expect(result.type).toBe('assistant');
      expect(result.uuid).toBe('67890-fghij');
      expect(result.requestId).toBe('req_456');
    });

    it('should successfully parse a summary message', () => {
      const validSummaryMessage = {
        type: 'summary',
        summary: 'This is a conversation summary',
        leafUuid: 'leaf-123',
      };

      const result = MessageValidator.parseJsonlMessage(validSummaryMessage, 0, '/test/file.jsonl');

      expect(result.type).toBe('summary');
      expect(result.summary).toBe('This is a conversation summary');
      expect(result.leafUuid).toBe('leaf-123');
    });

    it('should throw error for invalid message', () => {
      const invalidMessage = {
        uuid: 'missing-required-fields',
        // Missing required fields like sessionId, timestamp, type, message
      };

      expect(() => {
        MessageValidator.parseJsonlMessage(invalidMessage, 0, '/test/file.jsonl');
      }).toThrow('Invalid JSONL message format at line 0 in file /test/file.jsonl');
    });

    it('should throw error for completely malformed data', () => {
      const malformedData = 'not-an-object';

      expect(() => {
        MessageValidator.parseJsonlMessage(malformedData, 0, '/test/file.jsonl');
      }).toThrow('Invalid JSONL message format at line 0 in file /test/file.jsonl');
    });
  });

  describe('extractContent', () => {
    it('should extract content from valid user message', () => {
      const validMessage = {
        uuid: '12345',
        parentUuid: null,
        sessionId: 'session-123',
        timestamp: '2023-10-01T10:00:00.000Z',
        type: 'user' as const,
        message: {
          role: 'user' as const,
          content: 'Hello, world!',
        },
        isSidechain: false,
        userType: 'external' as const,
        cwd: '/Users/test/project',
        version: '1.0.73',
        gitBranch: 'main',
      };

      const parseResult = MessageValidator.parseJsonlMessage(validMessage);
      const content = MessageValidator.extractContent(parseResult);

      expect(content).toBe('Hello, world!');
    });

    it('should extract content from assistant message with content array', () => {
      const validMessage = {
        uuid: '67890',
        parentUuid: '12345',
        sessionId: 'session-123',
        timestamp: '2023-10-01T10:01:00.000Z',
        type: 'assistant' as const,
        message: {
          role: 'assistant' as const,
          content: [
            { type: 'text', text: 'I can help you with that.' },
            { type: 'tool_use', id: 'toolu_123', name: 'calculator', input: { operation: 'add', values: [1, 2] } },
          ],
          id: 'msg_123',
          type: 'message' as const,
          model: 'claude-sonnet-4-20250514',
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 0,
            output_tokens: 15,
            service_tier: 'standard' as const,
          },
        },
        toolUseResult: 'Result: 42',
        requestId: 'req_456',
        isSidechain: false,
        userType: 'external' as const,
        cwd: '/Users/test/project',
        version: '1.0.73',
        gitBranch: 'main',
      };

      const parseResult = MessageValidator.parseJsonlMessage(validMessage);
      const content = MessageValidator.extractContent(parseResult);

      expect(content).toBe('I can help you with that. [Tool: calculator]\n\n[Tool Result]\nResult: 42');
    });

    it('should extract content from summary message', () => {
      const summaryMessage = {
        type: 'summary' as const,
        summary: 'This is a conversation summary',
        leafUuid: 'leaf-123',
      };

      const parseResult = MessageValidator.parseJsonlMessage(summaryMessage);
      const content = MessageValidator.extractContent(parseResult);

      expect(content).toBe('This is a conversation summary');
    });

    it('should throw error for invalid messages', () => {
      const invalidMessage = {
        type: 'user',
        message: {
          content: 'Fallback content',
        },
      };

      expect(() => {
        MessageValidator.parseJsonlMessage(invalidMessage);
      }).toThrow('Invalid JSONL message format');
    });
  });

  describe('toIntermediateMessage', () => {
    it('should convert valid user message to intermediate format', () => {
      const validMessage = {
        uuid: '12345',
        parentUuid: null,
        sessionId: 'session-123',
        timestamp: '2023-10-01T10:00:00.000Z',
        type: 'user' as const,
        message: {
          role: 'user' as const,
          content: 'Hello, world!',
        },
        isSidechain: false,
        userType: 'external' as const,
        cwd: '/Users/test/project',
        version: '1.0.73',
        gitBranch: 'main',
      };

      const parseResult = MessageValidator.parseJsonlMessage(validMessage);
      const intermediateMessage = MessageValidator.toIntermediateMessage(parseResult);

      expect(intermediateMessage.id).toBe('12345');
      expect(intermediateMessage.content).toBe('Hello, world!');
      expect(intermediateMessage.role).toBe('user');
      expect(intermediateMessage.type).toBe('user');
      expect(intermediateMessage.timestamp).toBe('2023-10-01T10:00:00.000Z');
      expect(intermediateMessage.metadata?.parentUuid).toBeNull();
      expect(intermediateMessage.metadata?.sessionId).toBe('session-123');
      expect(intermediateMessage.metadata?.isSidechain).toBe(false);
    });

    it('should convert summary message to intermediate format', () => {
      const summaryMessage = {
        type: 'summary' as const,
        summary: 'This is a conversation summary',
        leafUuid: 'leaf-123',
      };

      const parseResult = MessageValidator.parseJsonlMessage(summaryMessage);
      const intermediateMessage = MessageValidator.toIntermediateMessage(parseResult);

      expect(intermediateMessage.id).toBe('leaf-123');
      expect(intermediateMessage.content).toBe('This is a conversation summary');
      expect(intermediateMessage.role).toBe('system');
      expect(intermediateMessage.type).toBe('summary');
    });

    it('should throw error for invalid message instead of fallback', () => {
      const invalidMessage = {
        uuid: 'test-id',
        type: 'user',
        content: 'Some content',
      };

      expect(() => {
        MessageValidator.parseJsonlMessage(invalidMessage);
      }).toThrow('Invalid JSONL message format');
    });
  });
});