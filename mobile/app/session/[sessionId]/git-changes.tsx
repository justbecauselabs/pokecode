import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { GitStatusResponse } from '@/api/client';
import { SafeAreaView } from '@/components/common';
import { useGitStatus } from '@/hooks/useGitStatus';

type Entry = GitStatusResponse['entries'][number];

function ChangeBadge(params: { change: Entry['change'] }) {
  const { change } = params;
  const map: Record<Entry['change'], { label: string; cls: string }> = {
    added: { label: 'A', cls: 'bg-green-900/30 text-green-300' },
    deleted: { label: 'D', cls: 'bg-red-900/30 text-red-300' },
    modified: { label: 'E', cls: 'bg-yellow-900/30 text-yellow-300' },
    renamed: { label: 'R', cls: 'bg-yellow-900/30 text-yellow-300' },
    copied: { label: 'C', cls: 'bg-purple-900/30 text-purple-300' },
    typechange: { label: 'T', cls: 'bg-orange-900/30 text-orange-300' },
    conflicted: { label: 'U', cls: 'bg-pink-900/30 text-pink-300' },
    untracked: { label: 'A', cls: 'bg-green-900/30 text-green-300' },
  };
  const v = map[change] ?? map.modified;
  return (
    <View className={`px-1.5 py-0.5 rounded ${v.cls}`}>
      <Text className="font-mono text-[11px]">{v.label}</Text>
    </View>
  );
}

export default function GitChangesScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data, isLoading, error, refetch } = useGitStatus({
    sessionId: sessionId ?? '',
    query: { scope: 'unstaged' },
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  return (
    <>
      <Stack.Screen options={{ title: 'Git Changes' }} />
      <SafeAreaView className="flex-1 bg-background">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-foreground/70">Loading…</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-destructive">Failed to load changes</Text>
            <Pressable className="mt-3" onPress={() => refetch()}>
              <Text className="text-primary">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlashList<Entry>
            data={entries}
            ItemSeparatorComponent={() => <View className="h-[1px] bg-muted/30" />}
            renderItem={({ item }) => (
              <Pressable
                className="flex-row items-center gap-3 px-3 py-2"
                onPress={() =>
                  router.push({
                    pathname: '/session/[sessionId]/git-diff',
                    params: { sessionId, path: item.path },
                  })
                }
              >
                <ChangeBadge change={item.change} />
                <View className="flex-1">
                  <Text className="text-foreground font-mono" numberOfLines={1}>
                    {item.path}
                  </Text>
                  {item.stats ? (
                    <Text className="text-xs font-mono">
                      <Text className="text-green-400">+{item.stats.additions}</Text>
                      <Text className="text-foreground/60"> </Text>
                      <Text className="text-red-400">-{item.stats.deletions}</Text>
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}
