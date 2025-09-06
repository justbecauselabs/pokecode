import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { apiClient } from '@/api/client';
import { SafeAreaView } from '@/components/common';
import { DiffViewer } from '@/components/diff/DiffViewer';
import { useGitDiff } from '@/hooks/useGitDiff';

function makeSyntheticUnified(params: { content: string }): string {
  const lines = params.content.split('\n');
  const n = lines.length;
  const header = ['--- /dev/null', `+++ b/${`${Date.now()}`}`];
  const hunk = `@@ -0,0 +1,${n} @@`;
  const body = lines.map((l) => `+${l}`);
  return ['diff --git a/ /dev/null', ...header, hunk, ...body].join('\n');
}

function FetchSyntheticDiff(params: { sessionId: string; path: string }) {
  const { sessionId, path } = params;
  const [text, setText] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await apiClient.getGitFile({ sessionId, query: { path, ref: 'WORKING' } });
        if (!cancelled) {
          const unified = makeSyntheticUnified({ content: file.content });
          setText(unified);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, path]);

  if (err) {
    return (
      <View className="p-3">
        <Text className="text-destructive font-mono">Failed to load diff: {err}</Text>
      </View>
    );
  }
  if (!text) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground/70">Building diff…</Text>
      </View>
    );
  }
  return <DiffViewer diffText={text} path={path} />;
}

export default function GitDiffScreen() {
  const { sessionId, path } = useLocalSearchParams<{ sessionId: string; path: string }>();
  const { data, isLoading, error, refetch } = useGitDiff({
    sessionId: sessionId ?? '',
    query: { path: path ?? '', scope: 'unstaged', context: 3 },
  });

  // Synthetic diff for empty unified when file is untracked
  // Placeholder memo (reserved for future if we compute locally)
  useMemo(() => data?.unified, [data]);

  return (
    <>
      <Stack.Screen options={{ title: path ?? 'Diff' }} />
      <SafeAreaView className="flex-1 bg-background">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-foreground/70">Loading diff…</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-destructive">Failed to load diff</Text>
            <Text className="text-xs text-foreground/60 mt-2">{String(error.message)}</Text>
            <Text className="text-primary mt-3" onPress={() => refetch()}>
              Retry
            </Text>
          </View>
        ) : data ? (
          data.isBinary ? (
            <View className="p-3">
              <Text className="text-foreground/70 font-mono">
                Binary file changed (no textual diff)
              </Text>
            </View>
          ) : data.unified.trim().length > 0 ? (
            <DiffViewer diffText={data.unified} path={path ?? ''} />
          ) : (
            <FetchSyntheticDiff sessionId={sessionId ?? ''} path={path ?? ''} />
          )
        ) : null}
      </SafeAreaView>
    </>
  );
}
