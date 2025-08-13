import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { homedir } from 'node:os';
import path from 'node:path';
import { CommandService } from '@/services/command.service';
import { ValidationError } from '@/types';

// Mock os module
vi.mock('node:os');

// Mock Bun global
const mockBunFile = vi.fn();
const mockBunGlob = vi.fn();

global.Bun = {
  file: mockBunFile,
  Glob: mockBunGlob,
} as any;

describe('CommandService', () => {
  let commandService: CommandService;
  const mockHomedir = vi.mocked(homedir);

  beforeEach(() => {
    commandService = new CommandService();
    
    // Setup common mocks
    mockHomedir.mockReturnValue('/home/testuser');
    
    // Reset all mocks
    vi.clearAllMocks();
    mockBunFile.mockClear();
    mockBunGlob.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listCommands', () => {
    const sessionId = 'test-session-123';
    const projectPath = '/test/project';
    const query = { type: 'all' as const };

    it('should list commands from both user and project directories', async () => {
      // Mock user commands directory
      const userCommandsPath = '/home/testuser/.claude/commands';
      const projectCommandsPath = '/test/project/commands';

      // Mock file existence checks for directory validation
      const mockUserFile = { exists: vi.fn().mockResolvedValue(true) };
      const mockProjectFile = { exists: vi.fn().mockResolvedValue(true) };
      
      mockBunFile
        .mockReturnValueOnce(mockUserFile)  // userCommandsPath check
        .mockReturnValueOnce(mockProjectFile); // projectCommandsPath check

      // Mock Bun.Glob for directory scanning to verify they're directories
      const mockUserGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      const mockProjectGlob = { scanSync: vi.fn().mockReturnValue(['dummy']) };
      
      mockBunGlob
        .mockReturnValueOnce(mockUserGlob)    // user directory validation
        .mockReturnValueOnce(mockProjectGlob) // project directory validation
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['user-command.md', 'another-user-cmd.md']) }) // user commands scan
        .mockReturnValueOnce({ scanSync: vi.fn().mockReturnValue(['project-command.md']) }); // project commands scan

      // Mock file reading for command contents
      const mockUserCommandFile1 = { text: vi.fn().mockResolvedValue('# User Command\nThis is a user command.') };
      const mockUserCommandFile2 = { text: vi.fn().mockResolvedValue('# Another User Command\nAnother user command.') };
      const mockProjectCommandFile = { text: vi.fn().mockResolvedValue('# Project Command\nThis is a project command.') };
      
      mockBunFile
        .mockReturnValueOnce(mockUserCommandFile1)   // user-command.md
        .mockReturnValueOnce(mockUserCommandFile2)   // another-user-cmd.md
        .mockReturnValueOnce(mockProjectCommandFile); // project-command.md

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        commands: [
          {
            name: 'user-command',
            body: '# User Command\nThis is a user command.',
            type: 'user',
          },
          {
            name: 'another-user-cmd',
            body: '# Another User Command\nAnother user command.',
            type: 'user',
          },
          {
            name: 'project-command',
            body: '# Project Command\nThis is a project command.',
            type: 'project',
          },
        ],
        sources: {
          userCommandsPath,
          projectCommandsPath,
        },
      });

      // Verify Bun.file was called for directory checks
      expect(mockBunFile).toHaveBeenCalledWith(userCommandsPath);
      expect(mockBunFile).toHaveBeenCalledWith(projectCommandsPath);
    });

    it('should handle missing user commands directory', async () => {
      const projectCommandsPath = '/test/project/commands';

      // Mock user commands directory doesn't exist, project does
      mockFs.stat
        .mockRejectedValueOnce({ code: 'ENOENT' }) // user commands don't exist
        .mockResolvedValueOnce({ isDirectory: () => true } as any); // project commands exist

      // Mock readdir for project commands only
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'project-only.md', isFile: () => true } as any,
      ]);

      mockFs.readFile.mockResolvedValueOnce('# Project Only Command');

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        commands: [
          {
            name: 'project-only',
            body: '# Project Only Command',
            type: 'project',
          },
        ],
        sources: {
          userCommandsPath: undefined,
          projectCommandsPath,
        },
      });
    });

    it('should handle missing project commands directory', async () => {
      const userCommandsPath = '/home/testuser/.claude/commands';

      // Mock user commands exist, project doesn't
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // user commands exist
        .mockRejectedValueOnce({ code: 'ENOENT' }); // project commands don't exist

      // Mock readdir for user commands only
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'user-only.md', isFile: () => true } as any,
      ]);

      mockFs.readFile.mockResolvedValueOnce('# User Only Command');

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        commands: [
          {
            name: 'user-only',
            body: '# User Only Command',
            type: 'user',
          },
        ],
        sources: {
          userCommandsPath,
          projectCommandsPath: undefined,
        },
      });
    });

    it('should filter commands by type', async () => {
      // Mock both directories exist with commands
      mockFs.stat
        .mockResolvedValue({ isDirectory: () => true } as any);

      mockFs.readdir
        .mockResolvedValueOnce([{ name: 'user-cmd.md', isFile: () => true } as any])
        .mockResolvedValueOnce([{ name: 'project-cmd.md', isFile: () => true } as any]);

      mockFs.readFile
        .mockResolvedValueOnce('User command content')
        .mockResolvedValueOnce('Project command content');

      // Test filtering for user commands only
      const userOnlyResult = await commandService.listCommands({
        sessionId,
        projectPath,
        query: { type: 'user' },
      });

      expect(userOnlyResult.commands).toHaveLength(1);
      expect(userOnlyResult.commands[0].type).toBe('user');

      // Reset mocks for next test
      vi.clearAllMocks();
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readdir
        .mockResolvedValueOnce([{ name: 'user-cmd.md', isFile: () => true } as any])
        .mockResolvedValueOnce([{ name: 'project-cmd.md', isFile: () => true } as any]);
      mockFs.readFile
        .mockResolvedValueOnce('User command content')
        .mockResolvedValueOnce('Project command content');

      // Test filtering for project commands only
      const projectOnlyResult = await commandService.listCommands({
        sessionId,
        projectPath,
        query: { type: 'project' },
      });

      expect(projectOnlyResult.commands).toHaveLength(1);
      expect(projectOnlyResult.commands[0].type).toBe('project');
    });

    it('should filter commands by search term', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'deploy-command.md', isFile: () => true } as any,
          { name: 'test-command.md', isFile: () => true } as any,
        ])
        .mockResolvedValueOnce([]);

      mockFs.readFile
        .mockResolvedValueOnce('# Deploy Command\nDeploy the application to production')
        .mockResolvedValueOnce('# Test Command\nRun unit tests');

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query: { search: 'deploy' },
      });

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('deploy-command');
    });

    it('should reject invalid project path', async () => {
      await expect(
        commandService.listCommands({
          sessionId,
          projectPath: '', // Invalid path
          query,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        commandService.listCommands({
          sessionId,
          projectPath: 'relative/path', // Not absolute
          query,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'good-command.md', isFile: () => true } as any,
        { name: 'bad-command.md', isFile: () => true } as any,
      ]);

      // First file reads successfully, second fails
      mockFs.readFile
        .mockResolvedValueOnce('# Good Command')
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query,
      });

      // Should only include the successful command
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('good-command');
    });

    it('should return empty array when no commands directories exist', async () => {
      // Both directories don't exist
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await commandService.listCommands({
        sessionId,
        projectPath,
        query,
      });

      expect(result).toEqual({
        commands: [],
        sources: {
          userCommandsPath: undefined,
          projectCommandsPath: undefined,
        },
      });
    });
  });
});