import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileService } from '@/services/file.service';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/types';
import { createTestSession, getTestDatabase } from '../helpers/database.helpers';
import * as schema from '@/db/schema';

// Mock fs module
vi.mock('node:fs/promises');

describe('FileService', () => {
  let fileService: FileService;
  let mockSession: typeof schema.sessions.$inferSelect;
  const mockFs = vi.mocked(fs);
  
  beforeEach(async () => {
    fileService = new FileService();
    mockSession = await createTestSession({
      projectPath: '/test/project',
    });
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validatePath', () => {
    it('should validate a normal relative path', async () => {
      const result = await fileService.validatePath('/test/project', 'src/index.ts');
      expect(result).toBe('/test/project/src/index.ts');
    });

    it('should validate current directory path', async () => {
      const result = await fileService.validatePath('/test/project', '.');
      expect(result).toBe('/test/project');
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        fileService.validatePath('/test/project', '../outside')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        fileService.validatePath('/test/project', '../../outside')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject absolute paths', async () => {
      await expect(
        fileService.validatePath('/test/project', '/absolute/path')
      ).rejects.toThrow(ValidationError);
    });

    it('should prevent escaping session directory', async () => {
      await expect(
        fileService.validatePath('/test/project', '../../../etc/passwd')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      // Mock successful directory stat
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      } as any);

      // Mock readdir
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'folder1', isDirectory: () => true, isFile: () => false },
        { name: '.hidden', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      ] as any);

      // Mock individual file stats
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // Initial directory check
        .mockResolvedValue({
          isFile: () => true,
          size: 1024,
          mtime: new Date('2023-01-01'),
        } as any);
    });

    it('should list files in directory', async () => {
      const result = await fileService.listFiles(mockSession.id, mockSession.projectPath, '.');
      
      expect(result.basePath).toBe(mockSession.projectPath);
      expect(result.files).toHaveLength(2); // Only visible files/folders
      expect(result.files[0].name).toBe('file1.ts');
      expect(result.files[1].name).toBe('folder1');
    });

    it('should filter files by pattern', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.js', isDirectory: () => false, isFile: () => true },
      ] as any);

      const result = await fileService.listFiles(
        mockSession.id,
        mockSession.projectPath,
        '.',
        { pattern: '*.ts' }
      );
      
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('file1.ts');
    });

    it('should handle recursive listing', async () => {
      // First call for root directory
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'folder1', isDirectory: () => true, isFile: () => false },
        ] as any)
        // Second call for subfolder
        .mockResolvedValueOnce([
          { name: 'nested.ts', isDirectory: () => false, isFile: () => true },
        ] as any);

      const result = await fileService.listFiles(
        mockSession.id,
        mockSession.projectPath,
        '.',
        { recursive: true }
      );
      
      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
      expect(result.files).toHaveLength(2); // folder1 + nested.ts
    });

    it('should throw error for non-existent directory', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        fileService.listFiles(mockSession.id, mockSession.projectPath, 'nonexistent')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for file instead of directory', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      await expect(
        fileService.listFiles(mockSession.id, mockSession.projectPath, 'file.txt')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('readFile', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date('2023-01-01'),
      } as any);
      
      mockFs.readFile.mockResolvedValue('file content');
    });

    it('should read file successfully', async () => {
      const result = await fileService.readFile(
        mockSession.id,
        mockSession.projectPath,
        'src/index.ts'
      );

      expect(result.path).toBe('src/index.ts');
      expect(result.content).toBe('file content');
      expect(result.encoding).toBe('utf-8');
      expect(result.size).toBe(1024);
      expect(result.mimeType).toBe('application/typescript');
    });

    it('should throw error for non-existent file', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        fileService.readFile(mockSession.id, mockSession.projectPath, 'nonexistent.ts')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for directory instead of file', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);

      await expect(
        fileService.readFile(mockSession.id, mockSession.projectPath, 'src')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error for file too large', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 20 * 1024 * 1024, // 20MB > 10MB limit
        mtime: new Date(),
      } as any);

      await expect(
        fileService.readFile(mockSession.id, mockSession.projectPath, 'large.file')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createFile', () => {
    beforeEach(() => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' }); // File doesn't exist
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should create file successfully', async () => {
      const result = await fileService.createFile(
        mockSession.id,
        mockSession.projectPath,
        'src/new.ts',
        'export const test = 1;'
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('src/new.ts');
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.dirname('/test/project/src/new.ts'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/project/src/new.ts',
        'export const test = 1;',
        'utf-8'
      );
    });

    it('should throw error for disallowed file extension', async () => {
      await expect(
        fileService.createFile(
          mockSession.id,
          mockSession.projectPath,
          'virus.exe',
          'malicious content'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if file already exists', async () => {
      mockFs.stat.mockResolvedValue({ size: 100 } as any); // File exists

      await expect(
        fileService.createFile(
          mockSession.id,
          mockSession.projectPath,
          'existing.ts',
          'content'
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('updateFile', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should update file successfully', async () => {
      const result = await fileService.updateFile(
        mockSession.id,
        mockSession.projectPath,
        'src/existing.ts',
        'updated content'
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('src/existing.ts');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/project/src/existing.ts',
        'updated content',
        'utf-8'
      );
    });

    it('should throw error for non-existent file', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        fileService.updateFile(
          mockSession.id,
          mockSession.projectPath,
          'nonexistent.ts',
          'content'
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for directory instead of file', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);

      await expect(
        fileService.updateFile(
          mockSession.id,
          mockSession.projectPath,
          'src',
          'content'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as any);
      mockFs.unlink.mockResolvedValue(undefined);
    });

    it('should delete file successfully', async () => {
      const result = await fileService.deleteFile(
        mockSession.id,
        mockSession.projectPath,
        'src/delete.ts'
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('src/delete.ts');
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/project/src/delete.ts');
    });

    it('should throw error for non-existent file', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        fileService.deleteFile(mockSession.id, mockSession.projectPath, 'nonexistent.ts')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error for directory', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as any);

      await expect(
        fileService.deleteFile(mockSession.id, mockSession.projectPath, 'src')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('file access logging', () => {
    beforeEach(() => {
      // Mock file operations
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
        mtime: new Date('2023-01-01'),
      } as any);
      mockFs.readFile.mockResolvedValue('content');
    });

    it('should log file read access', async () => {
      await fileService.readFile(mockSession.id, mockSession.projectPath, 'test.ts');

      // Check that file access was logged to database
      const db = getTestDatabase();
      const fileAccessRecords = await db.select().from(schema.fileAccess);
      
      expect(fileAccessRecords).toHaveLength(1);
      expect(fileAccessRecords[0].sessionId).toBe(mockSession.id);
      expect(fileAccessRecords[0].filePath).toBe('test.ts');
      expect(fileAccessRecords[0].accessType).toBe('read');
    });

    it('should log file creation with content', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await fileService.createFile(
        mockSession.id,
        mockSession.projectPath,
        'new.ts',
        'test content'
      );

      const db = getTestDatabase();
      const fileAccessRecords = await db.select().from(schema.fileAccess);
      
      expect(fileAccessRecords).toHaveLength(1);
      expect(fileAccessRecords[0].accessType).toBe('create');
      expect(fileAccessRecords[0].content).toBe('test content');
    });
  });

  describe('MIME type detection', () => {
    const testCases = [
      { file: 'test.js', expected: 'application/javascript' },
      { file: 'test.ts', expected: 'application/typescript' },
      { file: 'test.json', expected: 'application/json' },
      { file: 'test.md', expected: 'text/markdown' },
      { file: 'test.unknown', expected: 'application/octet-stream' },
    ];

    testCases.forEach(({ file, expected }) => {
      it(`should detect MIME type for ${file}`, async () => {
        mockFs.stat.mockResolvedValue({
          isFile: () => true,
          size: 100,
          mtime: new Date(),
        } as any);
        mockFs.readFile.mockResolvedValue('content');

        const result = await fileService.readFile(mockSession.id, mockSession.projectPath, file);
        expect(result.mimeType).toBe(expected);
      });
    });
  });

  describe('ignore patterns', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    });

    it('should ignore hidden files and common directories', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: '.hidden', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'visible.ts', isDirectory: () => false, isFile: () => true },
      ] as any);

      const result = await fileService.listFiles(mockSession.id, mockSession.projectPath, '.');
      
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('visible.ts');
    });
  });
});