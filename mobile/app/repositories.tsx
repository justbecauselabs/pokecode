import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { FileExplorer } from '@/components/session/FileExplorer';
import { RepositoryList } from '@/components/session/RepositoryList';
import { useCreateSession } from '@/hooks/useCreateSession';
import { useRepositories } from '@/hooks/useRepositories';

type ViewMode = 'options' | 'repositories' | 'explorer';

export default function RepositoriesScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('options');
  const { data, isLoading, error, refetch } = useRepositories();
  const createSessionMutation = useCreateSession();

  // Ensure repositories is always a valid array to prevent rendering errors
  const repositories = Array.isArray(data?.repositories) ? data.repositories : [];

  const handleSelectPath = async (path: string) => {
    try {
      // Extract folder name from path
      const folderName = path.split('/').pop() || path;

      // Create a temporary repository object for session creation
      const tempRepository = {
        folderName,
        path,
        isGitRepository: false, // This will be determined on the server side
        name: folderName, // Add compatibility field
        isGitRepo: false, // Add compatibility field
      };

      await createSessionMutation.mutateAsync({ repository: tempRepository });
    } catch (error) {
      console.error('Failed to create session from selected path:', error);
    }
  };

  const renderOptions = () => (
    <View className="flex-1 p-6">
      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        Start New Session
      </Text>

      <View className="space-y-4">
        <Pressable
          onPress={() => setViewMode('repositories')}
          className="bg-blue-500 active:bg-blue-600 p-4 rounded-lg"
        >
          <View className="flex-row items-center">
            <Text className="text-white text-lg font-medium mr-3">📁</Text>
            <View className="flex-1">
              <Text className="text-white text-lg font-semibold">Recent Repositories</Text>
              <Text className="text-blue-100 text-sm">
                Choose from your configured repositories
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setViewMode('explorer')}
          className="bg-green-500 active:bg-green-600 p-4 rounded-lg"
        >
          <View className="flex-row items-center">
            <Text className="text-white text-lg font-medium mr-3">🔍</Text>
            <View className="flex-1">
              <Text className="text-white text-lg font-semibold">Find a Project</Text>
              <Text className="text-green-100 text-sm">Browse directories on your computer</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderRepositories = () => (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <Pressable
          onPress={() => setViewMode('options')}
          className="py-2 px-4 active:bg-gray-100 dark:active:bg-gray-700 rounded"
        >
          <Text className="text-blue-500 font-medium">← Back</Text>
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900 dark:text-white text-center">
          Recent Repositories
        </Text>
        <View className="w-16" />
      </View>

      {/* Repository List */}
      <RepositoryList
        repositories={repositories}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
      />
    </View>
  );

  const renderExplorer = () => (
    <FileExplorer onSelectPath={handleSelectPath} onCancel={() => setViewMode('options')} />
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-white dark:bg-gray-900">
        {viewMode === 'options' && renderOptions()}
        {viewMode === 'repositories' && renderRepositories()}
        {viewMode === 'explorer' && renderExplorer()}
      </View>
    </SafeAreaView>
  );
}
