import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { RepositoryList } from '@/components/session/RepositoryList';
import { useRepositories } from '@/hooks/useRepositories';

export default function RepositoryListScreen() {
  const { data, isLoading, error, refetch } = useRepositories();

  // Ensure repositories is always a valid array to prevent rendering errors
  const repositories = Array.isArray(data?.repositories) ? data.repositories : [];

  return (
    <>
      <Stack.Screen options={{ title: 'Recent Repositories' }} />
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 bg-background">
          <RepositoryList
            repositories={repositories}
            isLoading={isLoading}
            error={error}
            onRefresh={refetch}
          />
        </View>
      </SafeAreaView>
    </>
  );
}
