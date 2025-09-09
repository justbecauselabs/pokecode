// Minimal unified diff utilities — no assertions, strict types

// Strip a single surrounding code fence, returning inner text and optional language
export function stripSingleCodeFence(input: string): { text: string; lang: string | null } {
  const trimmed = input.trim();
  if (!trimmed.startsWith('```') || trimmed.length < 6) {
    return { text: input, lang: null };
  }
  const firstLineBreak = trimmed.indexOf('\n');
  if (firstLineBreak === -1) {
    return { text: input, lang: null };
  }
  const fenceInfo = trimmed.slice(3, firstLineBreak).trim();
  const rest = trimmed.slice(firstLineBreak + 1);
  const closingIndex = rest.lastIndexOf('```\n');
  const closingExact = closingIndex === -1 ? rest.lastIndexOf('```') : closingIndex;
  if (closingExact === -1) {
    return { text: input, lang: null };
  }
  const inner = rest.slice(0, closingExact).trimEnd();
  const lang = fenceInfo.length > 0 ? fenceInfo : null;
  return { text: inner, lang };
}

// Heuristic detector for unified diffs
export function isUnifiedDiff(params: { text: string }): boolean {
  const { text } = params;
  if (text.trim().length === 0) return false;

  // Remove a surrounding code fence if present
  const { text: candidate, lang } = stripSingleCodeFence(text);
  const body = candidate;
  const lines = body.split('\n');

  // Quick checks
  if (lang && (lang.toLowerCase() === 'diff' || lang.toLowerCase() === 'patch')) {
    // Still verify presence of a hunk to avoid false positives
    if (lines.some((l) => /^@@\s-\d+(,\d+)?\s\+\d+(,\d+)?\s@@/.test(l))) return true;
  }

  if (body.startsWith('diff --git ')) return true;

  // Require file headers and a hunk header
  const hasOld = lines.some((l) => l.trimStart().startsWith('--- '));
  const hasNew = lines.some((l) => l.trimStart().startsWith('+++ '));
  const hunkIndex = lines.findIndex((l) =>
    /^@@\s-\d+(,\d+)?\s\+\d+(,\d+)?\s@@/.test(l.trimStart()),
  );
  if (!(hasOld && hasNew && hunkIndex !== -1)) return false;

  // After the first hunk, expect at least one add or del line
  for (let i = hunkIndex + 1; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trimStart();
    if (line.startsWith('+')) return true;
    if (line.startsWith('-')) return true;
    // context lines okay; continue scanning until next header
    if (line.startsWith('@@')) break;
  }
  return false;
}

export type DiffLineKind = 'hunk' | 'file_header' | 'add' | 'del' | 'ctx';

export type DiffLine = { kind: DiffLineKind; text: string };

// Convert unified diff text to simple line kinds for minimal rendering
export function toMinimalDiffLines(input: string): ReadonlyArray<DiffLine> {
  const { text } = stripSingleCodeFence(input);
  const out: DiffLine[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const s = raw.trimStart();
    if (s.startsWith('diff --git ') || s.startsWith('--- ') || s.startsWith('+++ ')) {
      out.push({ kind: 'file_header', text: raw });
      continue;
    }
    if (s.startsWith('@@')) {
      out.push({ kind: 'hunk', text: raw });
      continue;
    }
    if (s.startsWith('+')) {
      out.push({ kind: 'add', text: raw });
      continue;
    }
    if (s.startsWith('-')) {
      out.push({ kind: 'del', text: raw });
      continue;
    }
    out.push({ kind: 'ctx', text: raw });
  }

  return out;
}
