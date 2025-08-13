import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SessionCard } from '@/components/session/SessionCard';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { LoadingState } from '@/components/ui/LoadingState';
import { useDeleteSession, useSessions } from '@/hooks/useSessions';

export default function HomeScreen() {
  const { data: sessions = [], isLoading, error, refetch } = useSessions();
  const deleteSessionMutation = useDeleteSession();
  const router = useRouter();

  // Refetch sessions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Filter to only show active sessions
  const activeSessions = useMemo(() => {
    return sessions.filter((session) => session.status === 'active');
  }, [sessions]);

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to the session details screen
    router.push(`/session/${sessionId}`);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionMutation.mutateAsync(sessionId);
    } catch (_error) {
      Alert.alert('Error', 'Failed to delete session. Please try again.');
    }
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
              renderItem={({ item }) => (
                <SessionCard
                  session={item}
                  onPress={handleSessionSelect}
                  onDelete={handleDeleteSession}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
