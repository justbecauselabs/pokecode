import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { homedir } from 'node:os';
import path from 'node:path';
import { AgentService } from '@/services/agent.service';
import { ValidationError } from '@/types';

// Mock os module
vi.mock('node:os');

// Mock yaml module
vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

// Mock Bun global
const mockBunFile = vi.fn();
const mockBunGlob = vi.fn();

global.Bun = {
  file: mockBunFile,
  Glob: mockBunGlob,
} as any;

describe('AgentService', () => {
  let agentService: AgentService;
  const mockHomedir = vi.mocked(homedir);
  let mockParseYaml: any;

  beforeEach(async () => {
    agentService = new AgentService();
    
    // Import yaml parse mock after mocking
    const yaml = await import('yaml');
    mockParseYaml = vi.mocked(yaml.parse);
    
    // Setup common mocks
    mockHomedir.mockReturnValue('/home/testuser');
    
    // Reset all mocks
    vi.clearAllMocks();
    mockBunFile.mockClear();
    mockBunGlob.mockClear();
    mockParseYaml.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listAgents', () => {
    const sessionId = 'test-session-123';
    const projectPath = '/test/project';
    const query = { type: 'all' as const };

    it('should list agents from both user and project directories with YAML frontmatter', async () => {
      // Mock user agents directory
      const userAgentsPath = '/home/testuser/.claude/agents';
      const projectAgentsPath = '/test/project/agents';

      // Mock file existence checks for directory validation
      const mockUserFile = { exists: vi.fn().mockResolvedValue(true) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)  // userAgentsPath check
        .mockReturnValueOnce(mockProjectFile); // projectAgentsPath check

      // Mock Bun.Glob for directory scanning to verify they're directories
      const mockUserGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      
      mockBunGlob
        .mockReturnValueOnce(mockUserGlob)    // user directory validation
        .mockReturnValueOnce(mockProjectGlob) // project directory validation
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['backend-agent.md']) }) // user agents scan
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['frontend-agent.md']) }); // project agents scan

      // Mock file reading for agent contents with YAML frontmatter
      const userAgentContent = `---
name: backend-expert
description: Expert in backend development
color: blue
---

You are a backend development expert.`;

      const projectAgentContent = `---
name: frontend-guru
description: Expert in frontend frameworks
color: green
---

You are a frontend development expert.`;

      const mockUserAgentFile = { text: vi.fn().mockResolvedValue(userAgentContent) };
      const mockProjectAgentFile = { text: vi.fn().mockResolvedValue(projectAgentContent) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserAgentFile)   // backend-agent.md
        .mockReturnValueOnce(mockProjectAgentFile); // frontend-agent.md

      // Mock YAML parsing
      mockParseYaml
        .mockReturnValueOnce({
          name: 'backend-expert',
          description: 'Expert in backend development',
          color: 'blue',
        })
        .mockReturnValueOnce({
          name: 'frontend-guru',
          description: 'Expert in frontend frameworks',
          color: 'green',
        });

      const result = await agentService.listAgents({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        agents: [
          {
            name: 'backend-expert',
            description: 'Expert in backend development',
            color: 'blue',
            content: 'You are a backend development expert.',
            type: 'user',
          },
          {
            name: 'frontend-guru',
            description: 'Expert in frontend frameworks',
            color: 'green',
            content: 'You are a frontend development expert.',
            type: 'project',
          },
        ],
        sources: {
          userAgentsPath,
          projectAgentsPath,
        },
      });

      // Verify Bun.file was called for directory checks
      expect(mockBunFile).toHaveBeenCalledWith(userAgentsPath);
      expect(mockBunFile).toHaveBeenCalledWith(projectAgentsPath);
    });

    it('should handle agents without YAML frontmatter', async () => {
      const projectAgentsPath = '/test/project/agents';

      // Mock directory existence
      const mockUserFile = { exists: vi.fn().mockResolvedValue(false) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)  // user directory doesn't exist
        .mockReturnValueOnce(mockProjectFile); // project directory exists

      // Mock directory validation for project only
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      mockBunGlob
        .mockReturnValueOnce(mockProjectGlob) // project directory validation
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['simple-agent.md']) }); // project agents scan

      // Mock file reading for agent without frontmatter
      const agentContent = 'You are a simple agent without frontmatter.';
      const mockProjectAgentFile = { text: vi.fn().mockResolvedValue(agentContent) };
      
      mockBunFile.mockReturnValueOnce(mockProjectAgentFile);

      const result = await agentService.listAgents({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        agents: [
          {
            name: 'simple-agent', // Uses filename when no name in frontmatter
            description: '', // Empty when no description in frontmatter
            color: undefined,
            content: 'You are a simple agent without frontmatter.',
            type: 'project',
          },
        ],
        sources: {
          projectAgentsPath,
        },
      });
    });

    it('should filter agents by type', async () => {
      // Mock both directories exist with agents
      const mockUserFile = { exists: vi.fn().mockResolvedValue(true) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)
        .mockReturnValueOnce(mockProjectFile);

      // Mock directory validation
      const mockUserGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      
      mockBunGlob
        .mockReturnValueOnce(mockUserGlob)
        .mockReturnValueOnce(mockProjectGlob)
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['user-agent.md']) })
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['project-agent.md']) });

      // Mock file reading
      const userAgentFile = { text: vi.fn().mockResolvedValue('---\nname: user-agent\ndescription: User agent\n---\nUser content') };
      const projectAgentFile = { text: vi.fn().mockResolvedValue('---\nname: project-agent\ndescription: Project agent\n---\nProject content') };
      
      mockBunFile
        .mockReturnValueOnce(userAgentFile)
        .mockReturnValueOnce(projectAgentFile);

      // Mock YAML parsing
      mockParseYaml
        .mockReturnValueOnce({ name: 'user-agent', description: 'User agent' })
        .mockReturnValueOnce({ name: 'project-agent', description: 'Project agent' });

      // Test filtering for user agents only
      const userOnlyResult = await agentService.listAgents({
        sessionId,
        projectPath,
        query: { type: 'user' },
      });

      expect(userOnlyResult.agents).toHaveLength(1);
      expect(userOnlyResult.agents[0].type).toBe('user');
    });

    it('should filter agents by search term', async () => {
      // Mock project directory only
      const mockUserFile = { exists: vi.fn().mockResolvedValue(false) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)
        .mockReturnValueOnce(mockProjectFile);

      // Mock directory validation and scanning
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      mockBunGlob
        .mockReturnValueOnce(mockProjectGlob)
        .mockReturnValueOnce({ 
          scanSync: vi.fn().mockReturnValue(['backend-agent.md', 'frontend-agent.md']) 
        });

      // Mock file reading
      const backendContent = '---\nname: backend-expert\ndescription: Backend development specialist\n---\nBackend content';
      const frontendContent = '---\nname: frontend-expert\ndescription: Frontend UI specialist\n---\nFrontend content';
      
      const backendFile = { text: vi.fn().mockResolvedValue(backendContent) };
      const frontendFile = { text: vi.fn().mockResolvedValue(frontendContent) };
      
      mockBunFile
        .mockReturnValueOnce(backendFile)
        .mockReturnValueOnce(frontendFile);

      // Mock YAML parsing
      mockParseYaml
        .mockReturnValueOnce({ name: 'backend-expert', description: 'Backend development specialist' })
        .mockReturnValueOnce({ name: 'frontend-expert', description: 'Frontend UI specialist' });

      const result = await agentService.listAgents({
        sessionId,
        projectPath,
        query: { search: 'backend' },
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('backend-expert');
    });

    it('should reject invalid project path', async () => {
      await expect(
        agentService.listAgents({
          sessionId,
          projectPath: '', // Invalid path
          query,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        agentService.listAgents({
          sessionId,
          projectPath: 'relative/path', // Not absolute
          query,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle file read errors gracefully', async () => {
      // Mock project directory exists
      const mockUserFile = { exists: vi.fn().mockResolvedValue(false) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)
        .mockReturnValueOnce(mockProjectFile);

      // Mock directory validation and scanning
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      mockBunGlob
        .mockReturnValueOnce(mockProjectGlob)
        .mockReturnValueOnce({ 
          scanSync: vi.fn().mockReturnValue(['good-agent.md', 'bad-agent.md']) 
        });

      // First file reads successfully, second fails
      const goodFile = { text: vi.fn().mockResolvedValue('---\nname: good-agent\ndescription: Works fine\n---\nGood content') };
      const badFile = { text: vi.fn().mockRejectedValue(new Error('Permission denied')) };
      
      mockBunFile
        .mockReturnValueOnce(goodFile)
        .mockReturnValueOnce(badFile);

      // Mock YAML parsing for successful file
      mockParseYaml.mockReturnValueOnce({ name: 'good-agent', description: 'Works fine' });

      const result = await agentService.listAgents({
        sessionId,
        projectPath,
        query,
      });

      // Should only include the successful agent
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('good-agent');
    });

    it('should return empty array when no agents directories exist', async () => {
      // Both directories don't exist
      const mockUserFile = { exists: vi.fn().mockResolvedValue(false) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(false) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)
        .mockReturnValueOnce(mockProjectFile);

      const result = await agentService.listAgents({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        agents: [],
        sources: {},
      });
    });
  });
});