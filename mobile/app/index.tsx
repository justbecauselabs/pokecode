import { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessions, useDeleteSession } from '@/hooks/useSessions';
import { SessionCard } from '@/components/session/SessionCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { SafeAreaView } from '@/components/shared/SafeAreaView';

export default function HomeScreen() {
  const { data: sessions = [], isLoading, error, refetch } = useSessions();
  const deleteSessionMutation = useDeleteSession();
  const router = useRouter();

  // Filter to only show active sessions
  const activeSessions = useMemo(() => {
    return sessions.filter(session => session.status === 'active');
  }, [sessions]);

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to the session details screen
    router.push(`/session/${sessionId}`);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionMutation.mutateAsync(sessionId);
    } catch (error) {
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
          <Text className="text-red-500 text-center mb-4">
            Failed to load sessions
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="bg-blue-500 px-4 py-2 rounded"
          >
            <Text className="text-white font-medium">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* Header */}
        <View className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Sessions
          </Text>
          <Text className="text-gray-600 dark:text-gray-300">
            Manage your coding sessions
          </Text>
        </View>


        {/* Sessions List */}
        <View className="flex-1 px-4">
          {activeSessions.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-500 dark:text-gray-400 text-center text-lg">
                No active sessions
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-center mt-2">
                Create your first session to get started
              </Text>
            </View>
          ) : (
            <>
              {/* Show loading indicator during refresh */}
              {isLoading && (
                <View className="flex-row items-center justify-center py-2">
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text className="ml-2 text-gray-500 dark:text-gray-400">
                    Refreshing...
                  </Text>
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
      </View>
    </SafeAreaView>
  );
}
