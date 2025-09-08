import { FlashList } from '@shopify/flash-list';
import { type Change, diffWordsWithSpace } from 'diff';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const ADDED_FG = '#d1f2e0';
const ADDED_BG = '#1b5e3a';
const REMOVED_FG = '#ffd6d6';
const REMOVED_BG = '#6b2222';

type RowKind = 'hunk' | 'context' | 'add' | 'del';
type DiffRow = {
  key: string;
  kind: RowKind;
  oldNo: number | null;
  newNo: number | null;
  text: string;
};

type Token = { value: string; added?: boolean; removed?: boolean };
type DisplayRow = {
  key: string;
  kind: Exclude<RowKind, 'hunk'>;
  oldNo: number | null;
  newNo: number | null;
  sign: '+' | '-' | ' ';
  tokens: Token[];
};
type HunkRow = { key: string; kind: 'hunk'; text: string };

function toRows(diffText: string): DiffRow[] {
  // Minimal parser: recognizes @@ hunk headers and +/- lines.
  const lines = diffText.split('\n');
  let oldNo = 0;
  let newNo = 0;
  const out: DiffRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.startsWith('@@')) {
      out.push({ key: `h${i}`, kind: 'hunk', oldNo: null, newNo: null, text: line });
      // Try to extract starting numbers: @@ -a,b +c,d @@
      const match = /@@\s+-([0-9]+),?\d*\s+\+([0-9]+),?\d*\s+@@/.exec(line);
      if (match) {
        oldNo = Number(match[1]);
        newNo = Number(match[2]);
      }
      continue;
    }
    if (line.startsWith('+')) {
      newNo += 1;
      out.push({ key: `a${i}`, kind: 'add', oldNo: null, newNo, text: line });
      continue;
    }
    if (line.startsWith('-')) {
      oldNo += 1;
      out.push({ key: `d${i}`, kind: 'del', oldNo, newNo: null, text: line });
      continue;
    }
    oldNo += 1;
    newNo += 1;
    out.push({ key: `c${i}`, kind: 'context', oldNo, newNo, text: line });
  }

  return out;
}

function pairAndTokenize(rows: DiffRow[]): Array<DisplayRow | HunkRow> {
  const out: Array<DisplayRow | HunkRow> = [];
  let i = 0;
  while (i < rows.length) {
    const r: DiffRow = rows[i] as DiffRow;
    if (r.kind === 'hunk') {
      out.push({ key: r.key, kind: 'hunk', text: r.text });
      i += 1;
      continue;
    }
    const next: DiffRow | undefined = rows[i + 1];
    if (r.kind === 'del' && next && next.kind === 'add') {
      const delText = r.text.slice(1);
      const addText = next.text.slice(1);
      const tokens: Change[] = diffWordsWithSpace(delText, addText);
      const delTokens: Token[] = tokens.map((t: Change) => ({
        value: t.value ?? '',
        removed: t.removed === true,
      }));
      const addTokens: Token[] = tokens.map((t: Change) => ({
        value: t.value ?? '',
        added: t.added === true,
      }));
      out.push({
        key: r.key,
        kind: 'del',
        oldNo: r.oldNo,
        newNo: null,
        sign: '-',
        tokens: delTokens,
      });
      out.push({
        key: next.key,
        kind: 'add',
        oldNo: null,
        newNo: next.newNo,
        sign: '+',
        tokens: addTokens,
      });
      i += 2;
      continue;
    }
    const sign: '+' | '-' | ' ' = r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' ';
    out.push({
      key: r.key,
      kind: r.kind === 'context' ? 'context' : r.kind,
      oldNo: r.oldNo,
      newNo: r.newNo,
      sign,
      tokens: [{ value: r.text.slice(1) }],
    });
    i += 1;
  }
  return out;
}

export function DiffViewer(params: { diffText: string; path?: string }) {
  const { diffText } = params;
  const rows = useMemo(() => toRows(diffText), [diffText]);
  const displayRows = useMemo(() => pairAndTokenize(rows), [rows]);
  const { width } = useWindowDimensions();

  // Estimate a single horizontal scroll width across all lines
  const contentWidth = useMemo(() => {
    // count visible code chars (omit prefix for add/del/context)
    let maxCols = 0;
    for (const r of rows) {
      const len = r.kind === 'hunk' ? r.text.length : Math.max(0, r.text.length - 1);
      if (len > maxCols) maxCols = len;
    }
    const charPx = 7.2; // monospace approx @ 12px
    const gutterPx = 92; // line numbers + padding + prefix column
    const estimated = Math.floor(gutterPx + maxCols * charPx);
    return Math.max(width, estimated);
  }, [rows, width]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ width: contentWidth }}
    >
      <FlashList<DisplayRow | HunkRow>
        data={displayRows}
        keyExtractor={(r) => r.key}
        style={{ width: contentWidth }}
        renderItem={({ item }) => {
          const base = 'font-mono text-[14px]';
          if (item.kind === 'hunk') {
            return (
              <View className="bg-muted/30 px-2 py-1" style={{ width: contentWidth }}>
                <Text className={`${base} text-muted-foreground`}>{item.text}</Text>
              </View>
            );
          }
          const row = item as DisplayRow;
          const rowBg = row.kind === 'add' ? '#0c3b2a' : row.kind === 'del' ? '#4a1f1f' : '#2c313a';
          const rowFg = row.kind === 'add' ? '#c9f4d1' : row.kind === 'del' ? '#ffd1d1' : '#d7dae0';
          const lineNoBg = '#2a2f38';
          const lineNoFg = '#8b949e';
          return (
            <View
              className="flex-row px-2 py-0.5 items-start"
              style={{ width: contentWidth, backgroundColor: rowBg }}
            >
              <Text
                className={`${base} w-10 text-right pr-2`}
                style={{ color: lineNoFg, backgroundColor: lineNoBg }}
              >
                {row.oldNo ?? ''}
              </Text>
              <Text
                className={`${base} w-10 text-right pr-2`}
                style={{ color: lineNoFg, backgroundColor: lineNoBg }}
              >
                {row.newNo ?? ''}
              </Text>
              <Text className={`${base} pr-2`} style={{ color: rowFg }}>
                {row.sign}
              </Text>
              <Text numberOfLines={1} className={base} style={{ color: rowFg }}>
                {row.tokens.map((t, idx) => (
                  <Text
                    key={`${row.key}-${idx}-${t.added ? 'a' : t.removed ? 'd' : 'c'}`}
                    style={[
                      t.added ? styles.tokenAdded : t.removed ? styles.tokenRemoved : null,
                      !t.added && !t.removed ? { color: rowFg } : null,
                      t.added ? null : t.removed ? null : undefined,
                    ]}
                  >
                    {t.value}
                  </Text>
                ))}
              </Text>
            </View>
          );
        }}
      />
    </ScrollView>
  );
}

export type { DiffRow };

const styles = StyleSheet.create({
  tokenAdded: {
    backgroundColor: ADDED_BG,
    color: ADDED_FG,
  },
  tokenRemoved: {
    backgroundColor: REMOVED_BG,
    color: REMOVED_FG,
  },
});
