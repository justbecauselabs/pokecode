import { homedir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { NotFoundError, ValidationError } from '../types/index.js';

// Export Node.js path and os utilities for consistency
export const getHomeDirectory = homedir;
export const joinPath = path.join;
export const getBasename = path.basename;
export const getExtname = path.extname;
export const isAbsolute = path.isAbsolute;
export const getParentPath = path.dirname;
export const normalizePath = path.normalize;
export const getRelativePath = path.relative;

/**
 * Check if a directory exists using Bun APIs
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const glob = new Bun.Glob('*');
    Array.from(glob.scanSync({ cwd: dirPath, onlyFiles: false }));
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * List directory contents using Bun APIs
 */
export async function listDirectory(
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
  if (!(await directoryExists(dirPath))) {
    return [];
  }

  try {
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
      const pathInfo = await pathExists(fullPath);

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
 * Check if a path exists (file or directory) using Bun APIs
 */
export async function pathExists(targetPath: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
}> {
  try {
    const isDirectory = await directoryExists(targetPath);
    if (isDirectory) {
      return { exists: true, isDirectory: true, isFile: false };
    }

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
 * Find files matching a glob pattern using Bun APIs
 */
export async function findFiles(
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
 * Find markdown files in a directory
 */
export async function findMarkdownFiles(dirPath: string): Promise<string[]> {
  return findFiles(dirPath, '*.md', { absolute: true });
}

/**
 * Read file content as text using Bun APIs
 */
export async function readFileContent(filePath: string): Promise<string> {
  const pathInfo = await pathExists(filePath);

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
 * Check if path is a git repository
 */
export async function validateGitRepository(repoPath: string): Promise<{
  exists: boolean;
  isGitRepository: boolean;
}> {
  const pathInfo = await pathExists(repoPath);
  if (!pathInfo.exists || !pathInfo.isDirectory) {
    return { exists: false, isGitRepository: false };
  }

  const gitPath = path.join(repoPath, '.git');
  const gitInfo = await pathExists(gitPath);

  return {
    exists: true,
    isGitRepository: gitInfo.exists && gitInfo.isDirectory,
  };
}

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontMatter(content: string): {
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
 * Read and parse a markdown file with YAML frontmatter
 */
export async function readMarkdownFile(filePath: string): Promise<{
  frontMatter: Record<string, unknown>;
  content: string;
  fileName: string;
}> {
  const rawContent = await readFileContent(filePath);
  const parsed = parseFrontMatter(rawContent);
  const fileName = path.basename(filePath, path.extname(filePath));

  return {
    frontMatter: parsed.frontMatter,
    content: parsed.content,
    fileName,
  };
}
