# Git Diff Feature — Sessions

Owner: mobile + server
Target: September 2025 (v1), October 2025 (v1.1)

## Summary

Add a “Diff” experience scoped to a session’s project. From a session’s detail page, a top‑right button opens a Git Changes viewer. First view shows all affected files. Tapping a file opens a unified diff. Additions are green; deletions are red, always.

This spec covers server capabilities to query Git status and file diffs, REST endpoints, and a mobile viewer. It also lists React (web) diff viewer options in case we later add a web surface.

Non‑goals (v1): multi‑commit compare UIs, staging/committing, inline comments, or search in diff. v1.1 proposes commit range support.

## User Stories

- As a user on Session Detail, I can tap “Diff” to see all changed files in the session’s project.
- As a user, I can open any file and see a unified diff with clear coloring: green additions, red deletions.
- As a user, I can toggle staged vs unstaged changes and quickly refresh status.

## UX Flow (Mobile)

1) Session Detail header → add right‑side `Diff` icon/button.
2) Git Changes screen (initial):
   - Sections: Staged, Unstaged, Untracked (if present). List affected files (path, status badge, +/- counts when available).
   - Toggle: `View` → `Unstaged | Staged` (default: Unstaged). Pull‑to‑refresh.
3) File Diff screen:
   - Unified diff with virtualized list of hunks/lines.
   - Line styles: `+` green bg, `-` red bg, context neutral. Monospace font, wrap long lines off by default with horizontal scroll.
   - Header: filename, status (M/A/D/R), additions/deletions counts, “Staged/Unstaged” toggle.

Accessibility: announce counts and file status for screen readers; color is not the sole signifier (prefix symbols + legends).

## Data Model (API package)

Add Zod schemas in `@pokecode/api` (no `any` or type assertions):

- `GitStatusEntrySchema`:
  - `path: string`
  - `origPath?: string` (for renames/copies)
  - `index: 'A'|'M'|'D'|'R'|'C'|'U'|'T'|'?'|'!'|' '`
  - `worktree: 'A'|'M'|'D'|'R'|'C'|'U'|'T'|'?'|'!'|' '`
  - `staged: boolean` (derived: index ≠ ' ' and index ≠ '?')
  - `untracked: boolean`
  - `rename?: boolean`
  - `scores?: { similarity?: number }`
  - `isSubmodule?: boolean`

- `GitStatusResponseSchema`:
  - `repoRoot: string`
  - `branch?: string`
  - `ahead?: number`
  - `behind?: number`
  - `entries: GitStatusEntry[]`

- `GitStatusQuerySchema`:
  - `scope?: 'staged'|'unstaged'|'all'` (default `unstaged`)
  - `includeUntracked?: boolean` (default true)

- `GitDiffQuerySchema`:
  - `path: string`
  - `scope?: 'staged'|'unstaged'` (default `unstaged`)
  - `context?: number` (default 3)
  - `base?: string` (optional; v1.1 for commit ranges)

- `GitDiffResponseSchema`:
  - `path: string`
  - `isBinary: boolean`
  - `unified: string` (UTF‑8, no ANSI colors)
  - `stats?: { additions: number; deletions: number }`

- `GitFileQuerySchema`:
  - `path: string`
  - `ref?: 'WORKING'|'INDEX'|'HEAD'|string` (default `WORKING`)

- `GitFileResponseSchema`:
  - `path: string`
  - `ref: string`
  - `encoding: 'utf8'|'base64'`
  - `content: string`
  - `isBinary: boolean`

## Endpoints (Server)

Add under existing sessions routes to minimize risk and match current Fastify style:

- `GET /api/sessions/:sessionId/git/status`
  - Query: `GitStatusQuerySchema`
  - 200: `GitStatusResponseSchema`

- `GET /api/sessions/:sessionId/git/diff`
  - Query: `GitDiffQuerySchema`
  - 200: `GitDiffResponseSchema`

- `GET /api/sessions/:sessionId/git/file`
  - Query: `GitFileQuerySchema`
  - 200: `GitFileResponseSchema`

Notes
- All endpoints look up `projectPath` via `sessionService.getSession(sessionId)`.
- Return 400 for invalid path traversal, non‑UTF8 when `encoding=utf8` requested, or path outside repo root.
- Return 404 if path not tracked (when `ref!=WORKING`) and not present on disk for `WORKING`.

## Server Implementation (Core + Server)

Location
- Core: `packages/core/src/services/git.service.ts`
- Server: `packages/server/src/sessions/git.ts` registered at prefix `/api/sessions/:sessionId/git`

Runtime
- Use Bun process APIs: `Bun.$` or `Bun.spawn` for Git calls.
- Filesystem reads use `Bun.file(path)` with `.exists()` and `.text()`/`.arrayBuffer()`.

Repo Resolution
1) From session: `projectPath` (absolute). Verify Git root by walking up until `.git` exists (already similar to `SessionService.findGitRoot`). Use the actual root for `cwd`.
2) Reject if no Git repo: 400 with message `Not a git repository`.

Status
- Command (machine‑readable): `git -c color.ui=never status --porcelain=v2 -z --branch`
  - Untracked include: add `--untracked-files=all` when `includeUntracked=true`.
  - Parse NUL‑separated entries; map to `GitStatusEntry`.
  - Derive `staged` from index status; split entries into staged/unstaged on server for convenience when `scope` filter is used.

Diff
- Base flags: `git -c color.ui=never diff --no-ext-diff --no-color --unified=<context> --no-index` is NOT used; we do repo‑aware diffs:
  - Unstaged: `git diff --no-color -U<context> -- <path>`
  - Staged: `git diff --no-color --staged -U<context> -- <path>`
- Rename/copy detection enabled by default (`diff.renames`), or explicitly add `-M -C` (safe for single‑file ask as well).
- Binary detection: if `git diff --numstat -- <path>` yields `- -`, mark `isBinary=true` and omit `unified` body (or provide brief message and recommend `file` fetch with `encoding=base64`).
- Stats: parse `--numstat` for additions/deletions counts.

File (Content)
- `ref=WORKING`: read with `Bun.file(join(repoRoot, path))`; for large files choose stream when we add streaming.
- `ref=INDEX`: `git show :<path>` → bytes; attempt UTF‑8 decode; if fails, return `base64`.
- `ref=HEAD|<sha>`: `git show <ref>:<path>` with same decode logic.

Safety
- Normalize and validate `path`:
  - Reject absolute paths and `..` traversals after `path.normalize`.
  - Confirm that `join(repoRoot, normalizedPath)` starts with `repoRoot`.
- Enforce maximums: `maxUnifiedLines` (e.g., 20k) and `maxFileBytes` (e.g., 5 MB) with 413 response.

Errors
- 400: invalid query/path/ref, not a git repo, binary content with `encoding=utf8`.
- 404: file missing at requested ref.

## Mobile Implementation

API Client (mobile/src/api/client.ts)
- Add methods: `getGitStatus`, `getGitDiff`, `getGitFile` using above schemas from `@pokecode/api`.

Hooks
- `useGitStatus(sessionId, { scope })` with React Query; staleTime short (e.g., 5s), refetchOnFocus true.
- `useGitDiff(sessionId, path, { scope, context })`.

Screens/Components
- `app/session/[sessionId].tsx`: add headerRight `Diff` button.
- `app/session/[sessionId]/git-changes.tsx`: list view using `FlashList`.
  - Group by Staged/Unstaged; show status badges: M, A, D, R, ?.
- `app/session/[sessionId]/git-diff.tsx`: unified diff viewer.
  - Internal components: `HunkHeader`, `DiffLine` (prefix char, line number(s), content).
  - Styling: Tailwind classes; colors: additions `#20a162` (green‑600), deletions `#dc362e` (red‑600), context `#2c313a`.
  - Virtualization for large diffs; horizontal scroll for long lines.
  - Binary file message when `isBinary`.

### Component: DiffViewer.tsx (mobile)

- Location: `mobile/src/components/diff/DiffViewer.tsx`
- Responsibility: Render a unified diff string into a performant, virtualized list with fixed coloring rules.
- Dependencies: `@shopify/flash-list`, `gitdiff-parser` (add to mobile package.json dependencies).
- Constraints: No `any`, no type assertions; strict types inferred or declared.

Props
- `diffText: string` — unified diff text returned by the server.
- `estimatedItemSize?: number` — optional tuning for FlashList.

Internal Types
- `type RowKind = 'hunk' | 'context' | 'add' | 'del'`
- `type DiffRow = { key: string; kind: RowKind; oldNo: number | null; newNo: number | null; text: string }`

Behavior
- Parse once with `useMemo` using `gitdiff-parser` and normalize into `DiffRow[]`.
- Flatten all files (v1 we show single-file diffs per screen) → hunks → changes.
- Colors are fixed: additions green, deletions red; context neutral. Include leading `+`, `-`, or space for accessibility.
- Long lines: horizontal scroll per row.
- Large diffs: FlashList virtualization; avoid nested vertical scrolls.

Styling
- Monospace: use platform monospace family or a bundled font if available.
- Colors (tailwind-nativewind tokens):
  - Add: bg `bg-green-900/30`, text `text-green-300`
  - Del: bg `bg-red-900/30`, text `text-red-300`
  - Context: `text-foreground/70`
  - Hunk header: `text-muted-foreground`, `bg-muted/30`

Example Skeleton (typed, no assertions)

```tsx
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
// import { parse } from 'gitdiff-parser'; // exact import verified at implementation time

type RowKind = 'hunk' | 'context' | 'add' | 'del';
type DiffRow = { key: string; kind: RowKind; oldNo: number | null; newNo: number | null; text: string };

export function DiffViewer(params: { diffText: string; estimatedItemSize?: number }): JSX.Element {
  const { diffText, estimatedItemSize } = params;

  const rows = useMemo<DiffRow[]>(() => {
    // const files = parse(diffText); // returns parsed structure with files/hunks/changes
    // Minimal placeholder normalization (real impl uses parsed hunks):
    const lines = diffText.split('\n');
    let oldNo = 0;
    let newNo = 0;
    const out: DiffRow[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (line.startsWith('@@')) {
        out.push({ key: `h${i}`, kind: 'hunk', oldNo: null, newNo: null, text: line });
        continue;
      }
      if (line.startsWith('+')) {
        newNo += 1;
        out.push({ key: `a${i}`, kind: 'add', oldNo: null, newNo, text: line });
      } else if (line.startsWith('-')) {
        oldNo += 1;
        out.push({ key: `d${i}`, kind: 'del', oldNo, newNo: null, text: line });
      } else {
        oldNo += 1;
        newNo += 1;
        out.push({ key: `c${i}`, kind: 'context', oldNo, newNo, text: line });
      }
    }
    return out;
  }, [diffText]);

  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.key}
      estimatedItemSize={estimatedItemSize ?? 22}
      renderItem={({ item }) => {
        const base = 'font-mono text-[12px]';
        if (item.kind === 'hunk') {
          return (
            <View className="bg-muted/30 px-2 py-1">
              <Text className={`${base} text-muted-foreground`}>{item.text}</Text>
            </View>
          );
        }
        const lineStyle =
          item.kind === 'add'
            ? 'bg-green-900/30 text-green-300'
            : item.kind === 'del'
              ? 'bg-red-900/30 text-red-300'
              : 'text-foreground/70';
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className={`flex-row px-2 py-0.5 ${lineStyle}`}>
              <Text className={`${base} w-10 text-right pr-2 opacity-60`}>
                {item.oldNo ?? ''}
              </Text>
              <Text className={`${base} w-10 text-right pr-2 opacity-60`}>
                {item.newNo ?? ''}
              </Text>
              <Text className={`${base}`}>{item.text}</Text>
            </View>
          </ScrollView>
        );
      }}
    />
  );
}
```

Navigation Integration
- In `app/session/[sessionId].tsx` add a headerRight button to push `git-changes`.
- `git-changes.tsx` lists files; on press → navigate to `git-diff.tsx` with `{ path }`.
- `git-diff.tsx` fetches unified diff via `getGitDiff` and renders `<DiffViewer diffText={data.unified} />`.

Testing
- Snapshot the three line kinds and hunk header.
- Measure frame rate on a large synthetic diff (e.g., 15k lines) to validate FlashList settings.
- Verify color contrast in light/dark themes.

Parsing Strategy (RN)
- Prefer lightweight JS parser: `gitdiff-parser` to convert unified diff → hunks/lines.
- Alternative: implement minimal splitter by `@@` headers and line prefixes (`+`, `-`, ` `) for v1 if we want zero deps.

## React (Web) Diff Viewers — Options

If/when we add a web surface:

- `react-diff-view` + `gitdiff-parser`: Modern, themable, split/unified modes, maintained. Uses semantic hunks/lines model. MIT.
  - npm: https://www.npmjs.com/package/react-diff-view
  - parser: https://www.npmjs.com/package/gitdiff-parser
- `@alexbruf/react-diff-viewer` (maintained fork of `react-diff-viewer`): Simple API, supports React 18/19, unified or split views, theming. MIT.
  - npm: https://www.npmjs.com/package/@alexbruf/react-diff-viewer
- `diff2html`: Converts `git diff` to HTML with summary + pretty styling; can integrate in React. Heavier DOM output, but mature. MIT.
  - GitHub: https://github.com/rtfpessoa/diff2html
  - Site: https://diff2html.xyz
- `react-native-diff-view` (RN): RN components for diffs. Not actively maintained (2019), may require updates for RN 0.8x. Useful as reference for our RN implementation. MIT.
  - GitHub: https://github.com/jakemmarsh/react-native-diff-view

References
- Git status porcelain v2 and `--porcelain` format:
  - https://git-scm.com/docs/git-status
- Git diff and `--numstat` format:
  - https://git-scm.com/docs/git-diff

## Milestones

V1 (Server + Mobile basic viewer)
- Core `git.service.ts`: status, diff (single file), file content.
- Server routes: three GET endpoints with Zod schemas + validation.
- Mobile: header button → list of files → unified diff screen; additions/deletions coloring; staged/unstaged toggle.
- Tests: unit parse for status/diff; route tests with fixture repo in `packages/server/test-data`.

V1.1 (Quality + Ranges)
- Commit range support: `GET /git/diff?path=&base=<sha>&head=<sha>` and aggregate diff for all files.
- Large diff streaming (SSE or chunked) when unified body exceeds threshold.
- Line‑level copy/rename detection surfaced in UI.

## Testing

- Core
  - Parse porcelain v2 samples: modified, added, deleted, renamed, untracked, submodule.
  - Diff stats parse for text and binary.
  - Path normalization/security unit tests.
- Server
  - Route validation with invalid queries/paths.
  - 404/400 cases: non‑repo, missing file, binary with utf8 request.
- Mobile
  - Hooks cache + refetch behavior.
  - Snapshot tests for list + diff line components (dark/light).
  - Performance sanity on large diffs (virtualization active).

## Implementation Notes

- Keep server aligned with current Fastify setup. We can later migrate these endpoints to a Bun.serve adapter if we consolidate servers; for now Fastify is already in production.
- All shellouts use `Bun.$` for consistency and to avoid extra dependencies.
- Always pass `-c color.ui=never` to Git and strip ANSI if any appears from user config.

## Open Questions

- Should untracked files show a pseudo‑diff (entire file as additions) or only appear in list until staged? Proposal: show full additions diff guarded by size cap; if file > max bytes, show summary with “Open file” action.
- Do we need a UI control to switch context lines (e.g., 3/10/∞)? Proposal: hide in v1; add in v1.1.

---

Appendix: Command Sketches (server)

```ts
// Status
await Bun.$`git -c color.ui=never status --porcelain=v2 -z --branch ${includeUntracked ? '--untracked-files=all' : ''}`.cwd(projectPath);

// Diff (unstaged)
await Bun.$`git -c color.ui=never diff -U${context} -M -C -- ${path}`.cwd(projectPath);

// Diff (staged)
await Bun.$`git -c color.ui=never diff --staged -U${context} -M -C -- ${path}`.cwd(projectPath);

// Numstat for counts
await Bun.$`git -c color.ui=never diff --numstat -- ${path}`.cwd(projectPath);

// File (INDEX)
await Bun.$`git show :${path}`.cwd(projectPath);

// File (HEAD or SHA)
await Bun.$`git show ${ref}:${path}`.cwd(projectPath);
```

---

Sources
- react-diff-view (library) — maintained diff components. [See links below]
- @alexbruf/react-diff-viewer (maintained fork). [See links below]
- diff2html — CLI/JS library to render diff to HTML. [See links below]
- react-native-diff-view — RN diff components (older). [See links below]
- Git documentation: status porcelain v2 and diff formats. [See links below]

Link placeholders will be filled in PR using citations from the research section in this doc.
