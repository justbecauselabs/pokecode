import { z } from 'zod';

// ---------- Shared enums ----------

export const GitScopeSchema = z.union([
  z.literal('staged'),
  z.literal('unstaged'),
  z.literal('all'),
]);
export type GitScope = z.infer<typeof GitScopeSchema>;

export const GitRefSchema = z.union([
  z.literal('WORKING'),
  z.literal('INDEX'),
  z.literal('HEAD'),
  z.string(),
]);
export type GitRef = z.infer<typeof GitRefSchema>;

// Git two-character status codes per porcelain format (index/worktree)
export const GitStatusCodeSchema = z.union([
  z.literal('A'),
  z.literal('M'),
  z.literal('D'),
  z.literal('R'),
  z.literal('C'),
  z.literal('U'),
  z.literal('T'),
  z.literal('?'),
  z.literal('!'),
  z.literal(' '),
  // Some git versions emit '.' for no-change in porcelain v2
  z.literal('.'),
]);
export type GitStatusCode = z.infer<typeof GitStatusCodeSchema>;

// ---------- Status ----------

export const GitStatusEntrySchema = z.object({
  path: z.string(),
  origPath: z.string().optional(),
  index: GitStatusCodeSchema, // index status (first letter of XY)
  worktree: GitStatusCodeSchema, // worktree status (second letter of XY)
  staged: z.boolean(),
  untracked: z.boolean(),
  rename: z.boolean().optional(),
  scores: z
    .object({
      similarity: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  isSubmodule: z.boolean().optional(),
  stats: z
    .object({
      additions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    })
    .optional(),
  change: z.union([
    z.literal('added'),
    z.literal('deleted'),
    z.literal('modified'),
    z.literal('renamed'),
    z.literal('copied'),
    z.literal('typechange'),
    z.literal('conflicted'),
    z.literal('untracked'),
  ]),
});
export type GitStatusEntry = z.infer<typeof GitStatusEntrySchema>;

export const GitStatusQuerySchema = z.object({
  scope: GitScopeSchema.default('unstaged').optional(),
  includeUntracked: z.coerce.boolean().default(true).optional(),
});
export type GitStatusQuery = z.infer<typeof GitStatusQuerySchema>;

export const GitStatusResponseSchema = z.object({
  repoRoot: z.string(),
  branch: z.string().optional(),
  ahead: z.number().int().min(0).optional(),
  behind: z.number().int().min(0).optional(),
  entries: z.array(GitStatusEntrySchema),
});
export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;

// ---------- Diff ----------

export const GitDiffQuerySchema = z.object({
  path: z.string().min(1),
  scope: z
    .union([z.literal('staged'), z.literal('unstaged')])
    .default('unstaged')
    .optional(),
  context: z.coerce.number().int().min(0).max(1000).default(3).optional(),
  base: z.string().optional(),
});
export type GitDiffQuery = z.infer<typeof GitDiffQuerySchema>;

export const GitDiffResponseSchema = z.object({
  path: z.string(),
  isBinary: z.boolean(),
  unified: z.string(),
  stats: z
    .object({
      additions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    })
    .optional(),
});
export type GitDiffResponse = z.infer<typeof GitDiffResponseSchema>;

// ---------- File ----------

export const GitFileQuerySchema = z.object({
  path: z.string().min(1),
  ref: GitRefSchema.default('WORKING').optional(),
});
export type GitFileQuery = z.infer<typeof GitFileQuerySchema>;

export const GitFileResponseSchema = z.object({
  path: z.string(),
  ref: z.string(),
  encoding: z.union([z.literal('utf8'), z.literal('base64')]),
  content: z.string(),
  isBinary: z.boolean(),
});
export type GitFileResponse = z.infer<typeof GitFileResponseSchema>;
