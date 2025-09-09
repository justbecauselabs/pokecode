import type React from 'react';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { type DiffLine, toMinimalDiffLines } from '../../utils/diff';

// Minimal inline diff renderer: colors +/- lines; hunk/file headers muted

const COLORS = {
  // Emphasize colored text for +/- lines
  addText: '#20a162', // green
  delText: '#dc362e', // red
  ctxFg: '#d7dae0',
  hunkBg: '#2a2f38',
  hunkFg: '#8b949e',
} as const;

const monoFamily = 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace';

export const InlineDiffBlock: React.FC<{ diffText: string }> = memo(({ diffText }) => {
  const allLines = useMemo<ReadonlyArray<DiffLine>>(() => toMinimalDiffLines(diffText), [diffText]);
  // For inline chat display, drop file headers (---/+++) and hunk headers (@@)
  const lines = useMemo(
    () => allLines.filter((l) => l.kind !== 'file_header' && l.kind !== 'hunk'),
    [allLines],
  );

  return (
    <View className="bg-background">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.block}>
          {lines.map((l) => {
            if (l.kind === 'add') {
              return (
                <Text key={l.text} style={[styles.code, styles.add]}>
                  {l.text}
                </Text>
              );
            }
            if (l.kind === 'del') {
              return (
                <Text key={l.text} style={[styles.code, styles.del]}>
                  {l.text}
                </Text>
              );
            }
            return (
              <Text key={l.text} style={styles.code}>
                {l.text}
              </Text>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  code: {
    fontFamily: monoFamily,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.ctxFg,
  },
  add: {
    color: COLORS.addText,
  },
  del: {
    color: COLORS.delText,
  },
  // hunk styles retained in case we later add a toggle to show headers
  hunkRow: {
    backgroundColor: COLORS.hunkBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  hunkText: {
    fontFamily: monoFamily,
    fontSize: 12,
    color: COLORS.hunkFg,
  },
});
