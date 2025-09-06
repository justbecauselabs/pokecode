import { NotFoundError, ValidationError } from '../types';
import {
  getParentPath,
  getRelativePath,
  isAbsolute,
  joinPath,
  normalizePath,
  pathExists,
} from '../utils/file';
import { createChildLogger } from '../utils/logger';
import { sessionService } from './session.service';

const logger = createChildLogger('git-service');

// ---------- Types (kept local to core; API package defines Zod schemas) ----------

export type GitScope = 'staged' | 'unstaged' | 'all';
export type GitStatusCode = 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | 'T' | '?' | '!' | ' ' | '.';

export interface GitStatusEntry {
  path: string;
  origPath?: string;
  index: GitStatusCode;
  worktree: GitStatusCode;
  staged: boolean;
  untracked: boolean;
  rename?: boolean;
  scores?: { similarity?: number };
  isSubmodule?: boolean;
  stats?: { additions: number; deletions: number };
  change:
    | 'added'
    | 'deleted'
    | 'modified'
    | 'renamed'
    | 'copied'
    | 'typechange'
    | 'conflicted'
    | 'untracked';
}

export interface GitStatusOptions {
  scope?: GitScope | undefined;
  includeUntracked?: boolean | undefined;
}

export interface GitStatusResponse {
  repoRoot: string;
  branch?: string;
  ahead?: number;
  behind?: number;
  entries: GitStatusEntry[];
}

export interface GitDiffOptions {
  path: string;
  scope?: Exclude<GitScope, 'all'> | undefined;
  context?: number | undefined;
  base?: string | undefined;
}

export interface GitDiffResponse {
  path: string;
  isBinary: boolean;
  unified: string;
  stats?: { additions: number; deletions: number };
}

export type GitRef = 'WORKING' | 'INDEX' | 'HEAD' | string;

export interface GitFileOptions {
  path: string;
  ref?: GitRef | undefined;
}

export interface GitFileResponse {
  path: string;
  ref: string;
  encoding: 'utf8' | 'base64';
  content: string;
  isBinary: boolean;
}

// ---------- Helpers ----------

async function findGitRoot(startPath: string): Promise<string> {
  let current = normalizePath(startPath);
  // Walk up until filesystem root
  // Ensure loop terminates by tracking parent
  while (true) {
    const gitDir = joinPath(current, '.git');
    const exists = await pathExists(gitDir);
    if (exists.exists && exists.isDirectory) return current;

    const parent = getParentPath(current);
    if (parent === current) break;
    current = parent;
  }
  throw new ValidationError('Not a git repository');
}

function validateRepoRelativePath(repoRoot: string, requestedPath: string): string {
  if (requestedPath.length === 0) throw new ValidationError('Path is required');
  if (isAbsolute(requestedPath)) throw new ValidationError('Absolute paths are not allowed');
  const normalizedRel = normalizePath(requestedPath).replace(/^\/+/, '');
  const full = joinPath(repoRoot, normalizedRel);
  const relBack = getRelativePath(repoRoot, full);
  // Ensure path stays inside repo
  if (relBack.startsWith('..')) throw new ValidationError('Path traversal is not allowed');
  return normalizedRel;
}

function parseBranchHeader(lines: string[]): { branch?: string; ahead?: number; behind?: number } {
  const out: { branch?: string; ahead?: number; behind?: number } = {};
  for (const line of lines) {
    if (!line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    if (parts[1] === 'branch.head' && parts[2]) out.branch = parts[2];
    if (parts[1] === 'branch.ab' && parts.length >= 4) {
      const a = Number(parts[2]?.replace('+', ''));
      const b = Number(parts[3]?.replace('-', ''));
      if (!Number.isNaN(a)) out.ahead = a;
      if (!Number.isNaN(b)) out.behind = b;
    }
  }
  return out;
}

type ParsedStatusEntry = Omit<GitStatusEntry, 'change' | 'stats'>;

function parseStatusEntriesFromPorcelain(lines: string[]): ParsedStatusEntry[] {
  const entries: ParsedStatusEntry[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    if (line[0] === '#') continue; // header handled elsewhere

    // Porcelain v2 records:
    // 1 <XY> <sub> <mH> <mI> <mW> <hH> <path>
    // 2 <XY> <sub> <mH> <mI> <mW> <hH> <score> <path>\t<orig-path>
    // ? <path>
    const tag = line[0] ?? ' ';
    if (tag === '1') {
      // Safe split on spaces, last token is path (no NUL here; we pre-split by NUL)
      const parts = line.split(' ');
      // parts[1] is XY
      if (parts.length >= 8) {
        const xy = parts[1] ?? '  ';
        const path = parts[8] ?? parts[parts.length - 1] ?? '';
        const index = (xy[0] ?? ' ') as GitStatusCode;
        const worktree = (xy[1] ?? ' ') as GitStatusCode;
        entries.push({
          path,
          index,
          worktree,
          staged: index !== ' ' && index !== '?' && index !== '.',
          untracked: false,
        });
      }
      continue;
    }
    if (tag === '2') {
      // rename or copy
      // format: 2 XY ... score <path>\t<orig-path>
      const tabIdx = line.indexOf('\t');
      const left = tabIdx === -1 ? line : line.slice(0, tabIdx);
      const right = tabIdx === -1 ? '' : line.slice(tabIdx + 1);
      const leftParts = left.split(' ');
      if (leftParts.length >= 9) {
        const xy = leftParts[1] ?? '  ';
        const path = leftParts[9] ?? leftParts[leftParts.length - 1] ?? '';
        const origPath = right;
        const index = (xy[0] ?? ' ') as GitStatusCode;
        const worktree = (xy[1] ?? ' ') as GitStatusCode;
        entries.push({
          path,
          origPath,
          index,
          worktree,
          staged: index !== ' ' && index !== '?' && index !== '.',
          untracked: false,
          rename: true,
        });
      }
      continue;
    }
    if (tag === '?') {
      const untrackedPath = line.slice(2); // "? <path>" in v2 is actually "? <path>" or "? <path>"? v2 uses '?' + NUL path, but keep safe
      const path = untrackedPath.length > 0 ? untrackedPath : line.slice(1);
      entries.push({
        path,
        index: ' ',
        worktree: '?',
        staged: false,
        untracked: true,
      });
    }
    // Ignore other record types for v1
  }
  return entries;
}

type MinimalStatus = { worktree: GitStatusCode; staged: boolean; untracked: boolean };

function filterByScope<T extends MinimalStatus>(entries: T[], scope: GitScope): T[] {
  if (scope === 'all') return entries;
  if (scope === 'staged') return entries.filter((e) => e.staged && !e.untracked);
  // unstaged = worktree changes OR untracked
  return entries.filter(
    (e) => e.untracked || (e.worktree !== ' ' && e.worktree !== '!' && e.worktree !== '.'),
  );
}

function classifyChange(e: {
  index: GitStatusCode;
  worktree: GitStatusCode;
  untracked: boolean;
  rename?: boolean;
}): GitStatusEntry['change'] {
  if (e.untracked) return 'untracked';
  if (e.rename || e.index === 'R' || e.worktree === 'R') return 'renamed';
  if (e.index === 'D' || e.worktree === 'D') return 'deleted';
  if (e.index === 'A' || e.worktree === 'A') return 'added';
  if (e.index === 'C' || e.worktree === 'C') return 'copied';
  if (e.index === 'T' || e.worktree === 'T') return 'typechange';
  if (e.index === 'U' || e.worktree === 'U') return 'conflicted';
  return 'modified';
}

function decodeUtf8(bytes: Uint8Array): string {
  const td = new TextDecoder('utf-8');
  return td.decode(bytes);
}

function toLinesByNul(raw: string): string[] {
  // Porcelain v2 with -z returns NUL-separated records; split and filter empties
  return raw
    .split('\u0000')
    .map((s) => s.replace(/\n$/, ''))
    .filter((s) => s.length > 0);
}

function splitNumstatLine(
  line: string,
): { additions: number; deletions: number; path: string; isBinary: boolean } | null {
  // format: "<additions>\t<deletions>\t<path>"
  const parts = line.split('\t');
  if (parts.length < 3) return null;
  const a = parts[0] ?? '';
  const d = parts[1] ?? '';
  const p = parts.slice(2).join('\t');
  const isBinary = a === '-' || d === '-';
  const additions = a === '-' ? 0 : Number(a);
  const deletions = d === '-' ? 0 : Number(d);
  if (Number.isNaN(additions) || Number.isNaN(deletions)) return null;
  return { additions, deletions, path: p, isBinary };
}

// ---------- Service ----------

class GitService {
  async getStatus(params: {
    sessionId: string;
    options?: GitStatusOptions;
  }): Promise<GitStatusResponse> {
    const session = await sessionService.getSession(params.sessionId);
    const repoRoot = await findGitRoot(session.projectPath);

    const includeUntracked = params.options?.includeUntracked ?? true;
    const scope: GitScope = params.options?.scope ?? 'unstaged';

    const { $ } = Bun;
    const cmd =
      $`git -c color.ui=never status --porcelain=v2 -z --branch ${includeUntracked ? '--untracked-files=all' : '--untracked-files=no'}`.cwd(
        repoRoot,
      );
    const result = await cmd;
    const stdout = decodeUtf8(result.stdout);

    const records = toLinesByNul(stdout);
    // Branch header lines are not NUL-separated in porcelain v2 when combined with -z; guard by also splitting on newlines present in header
    const headerLines = records.filter((l) => l.startsWith('#'));
    const fileLines = records.filter((l) => !l.startsWith('#'));

    const header = parseBranchHeader(headerLines);
    const rawEntries = parseStatusEntriesFromPorcelain(fileLines);
    const entries = filterByScope(rawEntries, scope);

    // Compute per-file additions/deletions via numstat maps
    const stagedMap = new Map<
      string,
      { additions: number; deletions: number; isBinary: boolean }
    >();
    const unstagedMap = new Map<
      string,
      { additions: number; deletions: number; isBinary: boolean }
    >();

    // Helper to run numstat and fill a map
    const buildNumstatMap = async (
      staged: boolean,
      out: Map<string, { additions: number; deletions: number; isBinary: boolean }>,
    ) => {
      const num = staged
        ? await $`git -c color.ui=never diff --staged --numstat -z -M -C`.cwd(repoRoot)
        : await $`git -c color.ui=never diff --numstat -z -M -C`.cwd(repoRoot);
      const tokens = decodeUtf8(num.stdout)
        .split('\u0000')
        .filter((t) => t.length > 0);
      let i = 0;
      while (i < tokens.length) {
        const t = tokens[i] ?? '';
        const parts = t.split('\t');
        if (parts.length >= 3) {
          const aStr = parts[0] ?? '0';
          const dStr = parts[1] ?? '0';
          const path1 = parts.slice(2).join('\t');
          const maybeNext = tokens[i + 1] ?? '';
          const isRename = maybeNext.length > 0 && !maybeNext.includes('\t');
          const path2 = isRename ? maybeNext : undefined;
          const additions = aStr === '-' ? 0 : Number(aStr);
          const deletions = dStr === '-' ? 0 : Number(dStr);
          const isBinary = aStr === '-' || dStr === '-';
          const setFor = (p: string) => {
            if (p.length > 0) out.set(p, { additions, deletions, isBinary });
          };
          // Prefer mapping new path for renames; also map old for convenience
          if (path2) {
            setFor(path2);
            setFor(path1);
            i += 2;
          } else {
            setFor(path1);
            i += 1;
          }
        } else {
          i += 1;
        }
      }
    };

    if (scope === 'staged' || scope === 'all') {
      await buildNumstatMap(true, stagedMap);
    }
    if (scope === 'unstaged' || scope === 'all') {
      await buildNumstatMap(false, unstagedMap);
    }

    // Attach stats to entries
    const withStats: GitStatusEntry[] = [];
    for (const e of entries) {
      let stats = e.staged ? stagedMap.get(e.path) : unstagedMap.get(e.path);
      // For untracked files, numstat does not report; approximate as full additions = line count
      if (!stats && e.untracked && (scope === 'unstaged' || scope === 'all')) {
        try {
          const file = Bun.file(joinPath(repoRoot, e.path));
          const text = await file.text();
          const additions = text.length === 0 ? 0 : text.split('\n').length; // crude but effective
          stats = { additions, deletions: 0, isBinary: false };
        } catch {
          // If binary or unreadable, leave stats undefined
        }
      }
      withStats.push({
        ...e,
        change: classifyChange(e),
        ...(stats ? { stats: { additions: stats.additions, deletions: stats.deletions } } : {}),
      });
    }

    logger.debug({ count: entries.length, scope, repoRoot }, 'Git status parsed');
    return {
      repoRoot,
      ...header,
      entries: withStats,
    };
  }

  async getDiff(params: { sessionId: string; options: GitDiffOptions }): Promise<GitDiffResponse> {
    const session = await sessionService.getSession(params.sessionId);
    const repoRoot = await findGitRoot(session.projectPath);
    const scope: 'staged' | 'unstaged' = params.options.scope ?? 'unstaged';
    const context = params.options.context ?? 3;

    const rel = validateRepoRelativePath(repoRoot, params.options.path);
    const pathForGit = rel; // git paths are repo-relative
    const absPath = joinPath(repoRoot, rel);

    const { $ } = Bun;
    // numstat first for counts and binary detection
    const numstatCmd =
      scope === 'staged'
        ? $`git -c color.ui=never diff --staged --numstat -- ${pathForGit}`.cwd(repoRoot)
        : $`git -c color.ui=never diff --numstat -- ${pathForGit}`.cwd(repoRoot);
    const numstat = await numstatCmd;
    const numstatText =
      decodeUtf8(numstat.stdout)
        .split('\n')
        .find((l) => l.trim().length > 0) ?? '';
    const parsed = numstatText ? splitNumstatLine(numstatText) : null;

    let isBinary = parsed?.isBinary === true;

    // Unified diff; if binary, we still show a tiny header from git (it prints nothing). We’ll return empty unified when binary.
    let unified = '';
    if (!isBinary) {
      const diffCmd =
        scope === 'staged'
          ? $`git -c color.ui=never diff --staged -U${context} -M -C -- ${pathForGit}`.cwd(repoRoot)
          : $`git -c color.ui=never diff -U${context} -M -C -- ${pathForGit}`.cwd(repoRoot);
      const diff = await diffCmd;
      unified = decodeUtf8(diff.stdout);

      // If unstaged diff is empty and file is untracked, synthesize a diff: /dev/null -> working file
      if (scope === 'unstaged' && unified.trim().length === 0) {
        // Determine if tracked
        let isTracked = true;
        try {
          await $`git ls-files --error-unmatch -- ${pathForGit}`.cwd(repoRoot);
        } catch {
          isTracked = false;
        }
        if (!isTracked) {
          const proc = Bun.spawn({
            cmd: [
              'git',
              '-c',
              'color.ui=never',
              'diff',
              '--no-index',
              `-U${String(context)}`,
              '--',
              '/dev/null',
              absPath,
            ],
            cwd: repoRoot,
            stdout: 'pipe',
            stderr: 'pipe',
          });
          const text = await new Response(proc.stdout).text();
          if (/^Binary files /m.test(text)) {
            isBinary = true;
          } else {
            unified = text;
          }
        }
      }
    }

    const stats = parsed ? { additions: parsed.additions, deletions: parsed.deletions } : undefined;
    return {
      path: rel,
      isBinary,
      unified,
      ...(stats ? { stats } : {}),
    };
  }

  async getFile(params: { sessionId: string; options: GitFileOptions }): Promise<GitFileResponse> {
    const session = await sessionService.getSession(params.sessionId);
    const repoRoot = await findGitRoot(session.projectPath);
    const rel = validateRepoRelativePath(repoRoot, params.options.path);
    const ref = params.options.ref ?? 'WORKING';
    const { $ } = Bun;

    if (ref === 'WORKING') {
      const full = joinPath(repoRoot, rel);
      const exists = await pathExists(full);
      if (!exists.exists || !exists.isFile) throw new NotFoundError('File');
      const file = Bun.file(full);
      const isBinary = (await file.type).startsWith('application/') || (await file.type) === '';
      // Prefer text when possible; Bun.file().text() will throw on non-UTF8; catch and fallback to base64
      try {
        const text = await file.text();
        return { path: rel, ref: 'WORKING', encoding: 'utf8', content: text, isBinary: false };
      } catch {
        const buf = await file.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return { path: rel, ref: 'WORKING', encoding: 'base64', content: b64, isBinary };
      }
    }

    // INDEX or named ref
    const refSpec = ref === 'INDEX' ? `:${rel}` : `${ref}:${rel}`;
    const show = await $`git -c color.ui=never show ${refSpec}`.cwd(repoRoot);
    const bytes = show.stdout;
    // Try UTF-8 decode; if it fails (replacement), we treat as binary and return base64
    const text = decodeUtf8(bytes);
    // Heuristic: if the text contains lots of replacement characters, consider it binary
    const hasReplacement = text.includes('\uFFFD');
    if (!hasReplacement) {
      return { path: rel, ref: String(ref), encoding: 'utf8', content: text, isBinary: false };
    }
    const b64 = Buffer.from(bytes).toString('base64');
    return { path: rel, ref: String(ref), encoding: 'base64', content: b64, isBinary: true };
  }
}

export const gitService = new GitService();
