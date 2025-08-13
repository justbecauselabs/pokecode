import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { fileStorageConfig } from '@/config';
import { db } from '@/db';
import { fileAccess } from '@/db/schema-sqlite';
import type { FileInfo, GetFileResponse } from '@/schemas/file.schema';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/types';

interface NodeJSError extends Error {
  code?: string;
}

function isNodeJSError(error: unknown): error is NodeJSError {
  return error instanceof Error && 'code' in error;
}

export class FileService {
  // ============================================================================
  // SYSTEM-LEVEL OPERATIONS (No session validation, no database logging)
  // ============================================================================

  /**
   * Check if a directory exists using Bun APIs (system-level operation)
   */
  async systemDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      // Use Bun.Glob to check if we can scan the directory with onlyFiles: false
      const glob = new Bun.Glob('*');
      Array.from(glob.scanSync({ cwd: dirPath, onlyFiles: false }));
      return true; // If we can scan it, it's a directory
    } catch (_error) {
      return false; // If we can't scan it, it doesn't exist or isn't a directory
    }
  }

  /**
   * List directory contents using Bun APIs (system-level operation)
   */
  async systemListDirectory(
    dirPath: string,
    options: { includeHidden?: boolean } = {},
  ): Promise<
    Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      isFile: boolean;
    }>
  > {
    if (!(await this.systemDirectoryExists(dirPath))) {
      return [];
    }

    try {
      // Use Bun.Glob with onlyFiles: false to get both files and directories
      const glob = new Bun.Glob(options.includeHidden ? '*' : '[!.]*');
      const items = Array.from(
        glob.scanSync({
          cwd: dirPath,
          onlyFiles: false,
        }),
      );

      const results = [];
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const pathInfo = await this.systemPathExists(fullPath);

        results.push({
          name: item,
          path: fullPath,
          isDirectory: pathInfo.isDirectory,
          isFile: pathInfo.isFile,
        });
      }

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Check if a path exists (file or directory) using Bun APIs (system-level operation)
   */
  async systemPathExists(targetPath: string): Promise<{
    exists: boolean;
    isDirectory: boolean;
    isFile: boolean;
  }> {
    try {
      // First check if it's a directory by trying to scan it
      const isDirectory = await this.systemDirectoryExists(targetPath);
      if (isDirectory) {
        return { exists: true, isDirectory: true, isFile: false };
      }

      // If not a directory, check if it's a file using Bun.file()
      const file = Bun.file(targetPath);
      const exists = await file.exists();
      if (exists) {
        return { exists: true, isDirectory: false, isFile: true };
      }

      return { exists: false, isDirectory: false, isFile: false };
    } catch (_error) {
      return { exists: false, isDirectory: false, isFile: false };
    }
  }

  /**
   * Find files matching a glob pattern using Bun APIs (system-level operation)
   */
  async systemFindFiles(
    basePath: string,
    pattern: string,
    options: { absolute?: boolean } = {},
  ): Promise<string[]> {
    try {
      const glob = new Bun.Glob(pattern);
      const files = Array.from(glob.scanSync({ cwd: basePath, onlyFiles: false }));

      if (options.absolute) {
        return files.map((file) => path.join(basePath, file));
      }
      return files;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Find markdown files in a directory (system-level operation)
   */
  async systemFindMarkdownFiles(dirPath: string): Promise<string[]> {
    return this.systemFindFiles(dirPath, '*.md', { absolute: true });
  }

  /**
   * Read file content as text using Bun APIs (system-level operation)
   */
  async systemReadFileContent(filePath: string): Promise<string> {
    const pathInfo = await this.systemPathExists(filePath);

    if (!pathInfo.exists) {
      throw new NotFoundError('File');
    }

    if (!pathInfo.isFile) {
      throw new ValidationError('Path is not a file');
    }

    try {
      return await Bun.file(filePath).text();
    } catch (error) {
      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if path is a git repository (system-level operation)
   */
  async systemValidateGitRepository(repoPath: string): Promise<{
    exists: boolean;
    isGitRepository: boolean;
  }> {
    const pathInfo = await this.systemPathExists(repoPath);
    if (!pathInfo.exists || !pathInfo.isDirectory) {
      return { exists: false, isGitRepository: false };
    }

    const gitPath = path.join(repoPath, '.git');
    const gitInfo = await this.systemPathExists(gitPath);

    return {
      exists: true,
      isGitRepository: gitInfo.exists && gitInfo.isDirectory,
    };
  }

  /**
   * Parse YAML frontmatter from markdown content (system-level operation)
   */
  systemParseFrontMatter(content: string): {
    frontMatter: Record<string, unknown>;
    content: string;
  } {
    const frontMatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n(.*)/s);

    if (!frontMatterMatch) {
      return {
        frontMatter: {},
        content: content.trim(),
      };
    }

    try {
      const frontMatterYaml = frontMatterMatch[1];
      const mainContent = frontMatterMatch[2];

      if (!frontMatterYaml || !mainContent) {
        return {
          frontMatter: {},
          content: content.trim(),
        };
      }

      const frontMatter = parseYaml(frontMatterYaml) || {};

      return {
        frontMatter,
        content: mainContent.trim(),
      };
    } catch (_error) {
      return {
        frontMatter: {},
        content: content.trim(),
      };
    }
  }

  /**
   * Read and parse a markdown file with YAML frontmatter (system-level operation)
   */
  async systemReadMarkdownFile(filePath: string): Promise<{
    frontMatter: Record<string, unknown>;
    content: string;
    fileName: string;
  }> {
    const rawContent = await this.systemReadFileContent(filePath);
    const parsed = this.systemParseFrontMatter(rawContent);
    const fileName = path.basename(filePath, path.extname(filePath));

    return {
      frontMatter: parsed.frontMatter,
      content: parsed.content,
      fileName,
    };
  }

  // ============================================================================
  // SESSION-BASED OPERATIONS (Original methods with session validation and logging)
  // ============================================================================
  async validatePath(sessionPath: string, requestedPath: string): Promise<string> {
    // Normalize the requested path (must be relative to project root)
    const normalizedPath = path.normalize(requestedPath);

    // Prevent path traversal or absolute requested paths
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      throw new ValidationError('Invalid file path');
    }

    // Resolve base (sessionPath is expected to be an absolute project path)
    const resolvedBase = path.resolve(sessionPath);
    const resolvedPath = path.resolve(resolvedBase, normalizedPath);

    // Ensure requested path is within session directory
    if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
      throw new AuthorizationError('Path traversal attempt detected');
    }

    return resolvedPath;
  }

  async listFiles(
    sessionId: string,
    sessionPath: string,
    dirPath: string = '.',
    options: { recursive?: boolean; pattern?: string } = {},
  ): Promise<{ files: FileInfo[]; basePath: string }> {
    const validPath = await this.validatePath(sessionPath, dirPath);

    // Check if directory exists
    try {
      const stats = await fs.stat(validPath);
      if (!stats.isDirectory()) {
        throw new ValidationError('Path is not a directory');
      }
    } catch (error) {
      if (isNodeJSError(error) && error.code === 'ENOENT') {
        throw new NotFoundError('Directory');
      }
      throw error;
    }

    const files: FileInfo[] = [];
    const baseAbs = path.resolve(sessionPath);
    await this.scanDirectory(validPath, baseAbs, files, options);

    // Log file access
    await this.logFileAccess(sessionId, dirPath, 'read');

    return {
      files,
      basePath: sessionPath,
    };
  }

  private async scanDirectory(
    dirPath: string,
    baseAbs: string,
    files: FileInfo[],
    options: { recursive?: boolean; pattern?: string },
  ) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseAbs, fullPath);

      // Skip hidden files and common ignore patterns
      if (this.shouldIgnoreFile(entry.name)) {
        continue;
      }

      // Apply pattern filter if provided
      if (options.pattern && !this.matchesPattern(entry.name, options.pattern)) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push({
          path: relativePath,
          name: entry.name,
          type: 'directory',
        });

        if (options.recursive) {
          await this.scanDirectory(fullPath, baseAbs, files, options);
        }
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({
          path: relativePath,
          name: entry.name,
          type: 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      }
    }
  }

  async readFile(
    sessionId: string,
    sessionPath: string,
    filePath: string,
  ): Promise<GetFileResponse> {
    const validPath = await this.validatePath(sessionPath, filePath);

    // Check if file exists and is readable
    try {
      const stats = await fs.stat(validPath);
      if (!stats.isFile()) {
        throw new ValidationError('Path is not a file');
      }

      // Check file size
      if (stats.size > fileStorageConfig.maxFileSize) {
        throw new ValidationError(`File too large (max ${fileStorageConfig.maxFileSize} bytes)`);
      }
    } catch (error) {
      if (isNodeJSError(error) && error.code === 'ENOENT') {
        throw new NotFoundError('File');
      }
      throw error;
    }

    // Read file content
    const content = await fs.readFile(validPath, 'utf-8');
    const stats = await fs.stat(validPath);

    // Log file access
    await this.logFileAccess(sessionId, filePath, 'read');

    return {
      path: filePath,
      content,
      encoding: 'utf-8',
      size: stats.size,
      mimeType: this.getMimeType(filePath),
      modifiedAt: stats.mtime.toISOString(),
    };
  }

  async createFile(
    sessionId: string,
    sessionPath: string,
    filePath: string,
    content: string,
    encoding = 'utf-8',
  ) {
    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext && !fileStorageConfig.allowedExtensions.includes(ext)) {
      throw new ValidationError(`File type not allowed: ${ext}`);
    }

    const validPath = await this.validatePath(sessionPath, filePath);

    // Check if file already exists
    try {
      await fs.stat(validPath);
      throw new ConflictError('File already exists');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(validPath), { recursive: true });

    // Write file
    await fs.writeFile(validPath, content, encoding as BufferEncoding);

    // Log file access
    await this.logFileAccess(sessionId, filePath, 'create', content);

    return {
      success: true,
      path: filePath,
    };
  }

  async updateFile(
    sessionId: string,
    sessionPath: string,
    filePath: string,
    content: string,
    encoding = 'utf-8',
  ) {
    const validPath = await this.validatePath(sessionPath, filePath);

    // Check if file exists
    try {
      const stats = await fs.stat(validPath);
      if (!stats.isFile()) {
        throw new ValidationError('Path is not a file');
      }
    } catch (error) {
      if (isNodeJSError(error) && error.code === 'ENOENT') {
        throw new NotFoundError('File');
      }
      throw error;
    }

    // Write file
    await fs.writeFile(validPath, content, encoding as BufferEncoding);

    // Log file access
    await this.logFileAccess(sessionId, filePath, 'write', content);

    return {
      success: true,
      path: filePath,
    };
  }

  async deleteFile(sessionId: string, sessionPath: string, filePath: string) {
    const validPath = await this.validatePath(sessionPath, filePath);

    // Check if file exists
    try {
      const stats = await fs.stat(validPath);
      if (stats.isDirectory()) {
        throw new ValidationError('Cannot delete directories');
      }
    } catch (error) {
      if (isNodeJSError(error) && error.code === 'ENOENT') {
        throw new NotFoundError('File');
      }
      throw error;
    }

    // Delete file
    await fs.unlink(validPath);

    // Log file access
    await this.logFileAccess(sessionId, filePath, 'delete');

    return {
      success: true,
      path: filePath,
    };
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.jsx': 'application/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.scss': 'text/scss',
      '.less': 'text/less',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.cpp': 'text/x-c++',
      '.c': 'text/x-c',
      '.rs': 'text/x-rust',
      '.go': 'text/x-go',
      '.rb': 'text/x-ruby',
      '.php': 'text/x-php',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.toml': 'text/toml',
      '.xml': 'application/xml',
      '.sh': 'text/x-shellscript',
      '.bash': 'text/x-shellscript',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private shouldIgnoreFile(filename: string): boolean {
    const ignorePatterns = [
      /^\./, // Hidden files
      /^node_modules$/,
      /^\.git$/,
      /^dist$/,
      /^build$/,
      /^coverage$/,
      /\.pyc$/,
      /^__pycache__$/,
      /^\.DS_Store$/,
      /^Thumbs\.db$/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(filename));
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    return new RegExp(`^${regexPattern}$`).test(filename);
  }

  private async logFileAccess(
    sessionId: string,
    filePath: string,
    accessType: 'read' | 'write' | 'create' | 'delete',
    content?: string,
  ) {
    await db.insert(fileAccess).values({
      sessionId,
      filePath,
      accessType,
      ...(accessType === 'write' || accessType === 'create' ? (content ? { content } : {}) : {}),
      metadata: {
        ...(content && { size: Buffer.from(content).length }),
        mimeType: this.getMimeType(filePath),
        encoding: 'utf-8',
      },
    });
  }
}

export const fileService = new FileService();
