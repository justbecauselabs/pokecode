import { vi } from 'vitest';
import type { ClaudeDirectoryService } from '@/services/claude-directory.service';

/**
 * Mock data for Claude directory operations
 */
export interface MockClaudeDirectoryData {
  promptHistory: Array<{
    id: string;
    prompt: string;
    timestamp: string;
    status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
    result?: any;
  }>;
  files: Record<string, string>; // filepath -> content
  directories: string[];
}

/**
 * Create a mock Claude directory service with in-memory storage
 */
export function createMockClaudeDirectoryService(initialData: Partial<MockClaudeDirectoryData> = {}) {
  const mockData: MockClaudeDirectoryData = {
    promptHistory: [],
    files: {},
    directories: [],
    ...initialData,
  };

  const mockService = {
    // Directory operations
    initializeClaudeDirectory: vi.fn().mockImplementation(async (projectPath: string) => {
      const claudeDir = `/tmp/mock-claude/${projectPath.replace(/\//g, '_')}`;
      mockData.directories.push(claudeDir);
      return claudeDir;
    }),

    ensureClaudeDirectory: vi.fn().mockImplementation(async (claudeDirectoryPath: string) => {
      if (!mockData.directories.includes(claudeDirectoryPath)) {
        mockData.directories.push(claudeDirectoryPath);
      }
    }),

    cleanupClaudeDirectory: vi.fn().mockImplementation(async (claudeDirectoryPath: string) => {
      // Remove directory and all files within it
      const index = mockData.directories.indexOf(claudeDirectoryPath);
      if (index > -1) {
        mockData.directories.splice(index, 1);
      }
      
      // Remove all files in the directory
      Object.keys(mockData.files).forEach(filePath => {
        if (filePath.startsWith(claudeDirectoryPath)) {
          delete mockData.files[filePath];
        }
      });
    }),

    // Prompt operations
    writePromptRequest: vi.fn().mockImplementation(async (
      claudeDirectoryPath: string,
      promptId: string,
      prompt: string,
      allowedTools?: string[]
    ) => {
      const promptPath = `${claudeDirectoryPath}/prompts/${promptId}/request.txt`;
      mockData.files[promptPath] = prompt;
      
      if (allowedTools) {
        const toolsPath = `${claudeDirectoryPath}/prompts/${promptId}/allowed_tools.json`;
        mockData.files[toolsPath] = JSON.stringify(allowedTools);
      }
      
      mockData.promptHistory.push({
        id: promptId,
        prompt,
        timestamp: new Date().toISOString(),
        status: 'pending',
      });
    }),

    readPromptResponse: vi.fn().mockImplementation(async (
      claudeDirectoryPath: string,
      promptId: string
    ) => {
      const responsePath = `${claudeDirectoryPath}/prompts/${promptId}/response.json`;
      const content = mockData.files[responsePath];
      
      if (!content) {
        throw new Error('Response file not found');
      }
      
      return JSON.parse(content);
    }),

    writePromptResponse: vi.fn().mockImplementation(async (
      claudeDirectoryPath: string,
      promptId: string,
      response: any
    ) => {
      const responsePath = `${claudeDirectoryPath}/prompts/${promptId}/response.json`;
      mockData.files[responsePath] = JSON.stringify(response, null, 2);
      
      // Update prompt history
      const prompt = mockData.promptHistory.find(p => p.id === promptId);
      if (prompt) {
        prompt.status = 'completed';
        prompt.result = response;
      }
    }),

    getPromptHistory: vi.fn().mockImplementation(async (claudeDirectoryPath: string) => {
      return mockData.promptHistory.filter(prompt => {
        const promptPath = `${claudeDirectoryPath}/prompts/${prompt.id}`;
        return Object.keys(mockData.files).some(filePath => filePath.startsWith(promptPath));
      });
    }),

    cancelPrompt: vi.fn().mockImplementation(async (
      claudeDirectoryPath: string,
      promptId: string
    ) => {
      const prompt = mockData.promptHistory.find(p => p.id === promptId);
      if (prompt) {
        prompt.status = 'cancelled';
      }
      
      // Write cancellation marker
      const cancelPath = `${claudeDirectoryPath}/prompts/${promptId}/cancelled.txt`;
      mockData.files[cancelPath] = new Date().toISOString();
    }),

    // Utility methods for testing
    _getMockData: () => mockData,
    _clearMockData: () => {
      mockData.promptHistory.length = 0;
      Object.keys(mockData.files).forEach(key => delete mockData.files[key]);
      mockData.directories.length = 0;
    },
    _setMockFile: (filePath: string, content: string) => {
      mockData.files[filePath] = content;
    },
    _getMockFile: (filePath: string) => mockData.files[filePath],
  };

  return mockService as ClaudeDirectoryService & {
    _getMockData: () => MockClaudeDirectoryData;
    _clearMockData: () => void;
    _setMockFile: (filePath: string, content: string) => void;
    _getMockFile: (filePath: string) => string | undefined;
  };
}

/**
 * Create a mock that simulates Claude directory operations for a specific session
 */
export function createSessionMockClaudeDirectory(sessionId: string, projectPath: string) {
  const claudeDirectoryPath = `/tmp/mock-claude/session-${sessionId}`;
  
  return createMockClaudeDirectoryService({
    directories: [claudeDirectoryPath],
    files: {
      [`${claudeDirectoryPath}/.claude/session.json`]: JSON.stringify({
        sessionId,
        projectPath,
        createdAt: new Date().toISOString(),
      }),
    },
  });
}

/**
 * Helper to mock the Claude directory service module
 */
export function mockClaudeDirectoryModule(mockService: ReturnType<typeof createMockClaudeDirectoryService>) {
  vi.doMock('@/services/claude-directory.service', () => ({
    ClaudeDirectoryService: vi.fn().mockImplementation(() => mockService),
    claudeDirectoryService: mockService,
  }));
}

/**
 * Reset all Claude directory mocks
 */
export function resetClaudeDirectoryMocks() {
  vi.restoreAllMocks();
}