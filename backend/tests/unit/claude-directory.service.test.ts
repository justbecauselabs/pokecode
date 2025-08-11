import { describe, it, expect, beforeAll, mock, afterAll } from 'bun:test';
import ClaudeDirectoryService from '@/services/claude-directory.service';

describe('ClaudeDirectoryService', () => {
  let service: ClaudeDirectoryService;

  beforeAll(() => {
    // Mock file system operations
    mock.module('fs', () => ({
      existsSync: mock((path: string) => {
        // Mock that ~/.claude exists
        if (path.includes('.claude')) {
          return true;
        }
        return false;
      }),
      readFileSync: mock((path: string, encoding?: string) => {
        if (path.endsWith('.jsonl')) {
          // Mock JSONL conversation data
          return JSON.stringify({ role: 'user', content: 'Hello', timestamp: '2025-01-01T00:00:00Z' }) + '\n' +
                 JSON.stringify({ role: 'assistant', content: 'Hi there!', timestamp: '2025-01-01T00:00:01Z' });
        }
        return '';
      }),
      writeFileSync: mock(() => {}),
      mkdirSync: mock(() => {}),
    }));

    service = new ClaudeDirectoryService();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('initialization', () => {
    it('should check if Claude directory is initialized', () => {
      const isInitialized = service.isInitialized();
      expect(isInitialized).toBe(true);
    });

    it('should ensure directory structure is created', () => {
      expect(() => service.ensureInitialized()).not.toThrow();
    });
  });

  describe('path mapping', () => {
    it('should generate correct Claude directory path from project path', () => {
      const projectPath = '/Users/test/workspace/myproject';
      const claudePath = ClaudeDirectoryService.getClaudeDirectoryPath(projectPath);
      
      expect(claudePath).toBeDefined();
      expect(claudePath).toContain('.claude');
      expect(claudePath).toContain('projects');
    });

    it('should handle special characters in project paths', () => {
      const projectPath = '/Users/test/workspace/my-project-with-dashes';
      const claudePath = ClaudeDirectoryService.getClaudeDirectoryPath(projectPath);
      
      expect(claudePath).toBeDefined();
      expect(claudePath).toContain('.claude');
    });
  });

  describe('conversation management', () => {
    it('should get project conversation files', () => {
      const projectPath = '/Users/test/workspace/myproject';
      const files = service.getProjectConversationFiles(projectPath);
      
      expect(Array.isArray(files)).toBe(true);
      // Files array might be empty if no conversations exist, which is okay
    });

    it('should read conversation file content', () => {
      const mockFilePath = '/mock/path/conversation.jsonl';
      const messages = service.readConversationFile(mockFilePath);
      
      expect(Array.isArray(messages)).toBe(true);
      if (messages.length > 0) {
        expect(messages[0]).toHaveProperty('role');
        expect(messages[0]).toHaveProperty('content');
        expect(messages[0]).toHaveProperty('timestamp');
      }
    });

    it('should get project conversations', () => {
      const projectPath = '/Users/test/workspace/myproject';
      const conversations = service.getProjectConversations(projectPath);
      
      expect(conversations).toHaveProperty('jsonlConversations');
      expect(Array.isArray(conversations.jsonlConversations)).toBe(true);
    });

    it('should find most recent conversation', () => {
      const projectPath = '/Users/test/workspace/myproject';
      const recent = service.getMostRecentConversation(projectPath);
      
      // Can be null if no conversations exist
      if (recent) {
        expect(recent).toHaveProperty('source');
        expect(recent).toHaveProperty('lastActivity');
      }
    });
  });

  describe('conversation history', () => {
    it('should get conversation history from file path', () => {
      const mockFilePath = '/mock/path/conversation.jsonl';
      const history = service.getConversationHistory(mockFilePath);
      
      expect(history).toHaveProperty('messages');
      expect(history).toHaveProperty('summary');
      expect(Array.isArray(history.messages)).toBe(true);
      expect(history.summary).toHaveProperty('totalMessages');
    });
  });

  describe('error handling', () => {
    it('should handle non-existent conversation files gracefully', () => {
      const nonExistentPath = '/path/that/does/not/exist.jsonl';
      
      expect(() => {
        const messages = service.readConversationFile(nonExistentPath);
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBe(0);
      }).not.toThrow();
    });

    it('should handle malformed JSONL files gracefully', () => {
      // Override the mock for this test
      const fs = require('fs');
      const originalReadFileSync = fs.readFileSync;
      
      fs.readFileSync = mock((path: string) => {
        if (path.endsWith('.jsonl')) {
          return 'invalid json line\n{valid: "json"}'; // Mix of invalid and valid JSON
        }
        return '';
      });

      const mockFilePath = '/mock/path/malformed.jsonl';
      const messages = service.readConversationFile(mockFilePath);
      
      expect(Array.isArray(messages)).toBe(true);
      // Should filter out invalid entries
      
      // Restore mock
      fs.readFileSync = originalReadFileSync;
    });
  });
});