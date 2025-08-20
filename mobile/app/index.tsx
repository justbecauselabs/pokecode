import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { Session } from '@/api/client';
import { LoadingState, SafeAreaView } from '@/components/common';
import { useDeleteSession, useSessions } from '@/hooks/useSessions';
import { formatRelativeTime } from '@/utils/format';

export default function HomeScreen() {
  const { data: sessions = [], isLoading, error, refetch } = useSessions();
  const deleteSessionMutation = useDeleteSession();
  const router = useRouter();

  const getStateColor = (state: Session['state']) => {
    switch (state) {
      case 'active':
        return 'text-success';
      case 'inactive':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStateLabel = (state: Session['state']) => {
    switch (state) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
    }
  };

  const truncatePath = (path: string, maxLength: number = 40) => {
    if (path.length <= maxLength) {
      return path;
    }
    return `...${path.slice(-(maxLength - 3))}`;
  };

  // Refetch sessions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Filter to only show active sessions
  const activeSessions = useMemo(() => {
    return sessions.filter((session) => session.state === 'active');
  }, [sessions]);

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to the session details screen
    router.push(`/session/${sessionId}`);
  };

  const handleLongPress = (session: Session) => {
    Alert.alert('Session Actions', session.projectPath, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Session',
        style: 'destructive',
        onPress: () => handleDeleteSession(session.id),
      },
    ]);
  };

  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSessionMutation.mutateAsync(sessionId);
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete session. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (isLoading && sessions.length === 0) {
    return <LoadingState message="Loading sessions..." />;
  }

  if (error && sessions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-destructive text-center mb-4 font-mono">
            Failed to load sessions
          </Text>
          <Pressable onPress={() => refetch()} className="bg-primary px-4 py-2 rounded-lg">
            <Text className="text-primary-foreground font-medium font-mono">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background px-4">
        {activeSessions.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-muted-foreground text-center text-lg font-mono">
              No active sessions
            </Text>
            <Text className="text-muted-foreground/70 text-center mt-2 mb-6 font-mono">
              Create your first session to get started
            </Text>
            <Pressable
              onPress={() => router.push('/repositories')}
              className="bg-primary px-6 py-3 rounded-lg"
            >
              <Text className="text-primary-foreground font-medium font-mono text-center">
                Create New Session
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Show loading indicator during refresh */}
            {isLoading && (
              <View className="flex-row items-center justify-center py-2">
                <ActivityIndicator size="small" color="#528bff" />
                <Text className="ml-2 text-muted-foreground font-mono">Refreshing...</Text>
              </View>
            )}

            <FlatList
              data={activeSessions}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View>
                  <Pressable
                    onPress={() => handleSessionSelect(item.id)}
                    onLongPress={() => handleLongPress(item)}
                    className="py-4 active:opacity-80"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 mr-3">
                        <Text
                          className="text-base font-semibold text-foreground font-mono mb-1"
                          numberOfLines={1}
                        >
                          {truncatePath(item.projectPath)}
                        </Text>
                        {item.context && (
                          <Text
                            className="text-sm text-muted-foreground font-mono mb-2"
                            numberOfLines={2}
                          >
                            {item.context}
                          </Text>
                        )}
                        <Text className="text-xs text-muted-foreground font-mono mb-1">
                          {formatRelativeTime(item.lastAccessedAt)}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground font-mono">
                            {item.messageCount} msg
                          </Text>
                          <Text className="text-xs text-muted-foreground font-mono">•</Text>
                          <Text className="text-xs text-muted-foreground font-mono">
                            {item.tokenCount.toLocaleString()} tokens
                          </Text>
                        </View>
                      </View>
                      <Text
                        className={`text-sm font-medium font-mono ${getStateColor(item.state)}`}
                      >
                        {getStateLabel(item.state)}
                      </Text>
                    </View>
                  </Pressable>
                  {index < activeSessions.length - 1 && <View className="h-px bg-border" />}
                </View>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-5"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
