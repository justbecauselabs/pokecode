import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { RepositoryList } from '@/components/session/RepositoryList';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { useRepositories } from '@/hooks/useRepositories';

export default function RepositoriesScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useRepositories();

  const repositories = data?.repositories || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Select Repository
            </Text>
            <Text className="text-gray-600 dark:text-gray-300">
              Choose a repository to start a new session
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            className="ml-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">Cancel</Text>
          </Pressable>
        </View>

        {/* Repository Directory Info */}
        {data?.githubReposDirectory && (
          <View className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
            <Text className="text-blue-700 dark:text-blue-300 text-sm">
              <Text className="font-medium">Repository Directory:</Text> {data.githubReposDirectory}
            </Text>
          </View>
        )}

        {/* Repository List */}
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
