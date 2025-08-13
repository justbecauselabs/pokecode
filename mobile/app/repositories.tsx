import { View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { RepositoryList } from '@/components/session/RepositoryList';
import { useRepositories } from '@/hooks/useRepositories';

export default function RepositoriesScreen() {
  const { data, isLoading, error, refetch } = useRepositories();

  const repositories = data?.repositories || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-white dark:bg-gray-900">
        <RepositoryList
          repositories={repositories}
          isLoading={isLoading}
          error={error}
          onRefresh={refetch}
        />
      </View>
    </SafeAreaView>
  );
}
