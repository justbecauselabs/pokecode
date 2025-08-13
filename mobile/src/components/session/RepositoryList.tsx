import { memo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useCreateSession } from '@/hooks/useCreateSession';
import type { Repository } from '@/hooks/useRepositories';

interface RepositoryListProps {
  repositories: Repository[];
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
}

interface RepositoryItemProps {
  repository: Repository;
  onPress: (repository: Repository) => void;
  isCreating?: boolean;
}

const RepositoryItem = memo(({ repository, onPress, isCreating }: RepositoryItemProps) => {
  return (
    <Pressable
      onPress={() => onPress(repository)}
      disabled={isCreating}
      className="flex-row items-center py-3 px-4 active:bg-gray-50 dark:active:bg-gray-700"
    >
      {/* Repository Info */}
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-lg font-medium text-gray-900 dark:text-white mr-2">
            {repository.folderName}
          </Text>
          {repository.isGitRepository && (
            <View className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
              <Text className="text-green-700 dark:text-green-300 text-xs font-medium">Git</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-500 dark:text-gray-400 text-sm" numberOfLines={1}>
          {repository.path}
        </Text>
      </View>

      {/* Loading indicator for this specific item */}
      {isCreating && (
        <View className="ml-3">
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      )}
    </Pressable>
  );
});

export const RepositoryList = memo(
  ({ repositories, isLoading, error, onRefresh }: RepositoryListProps) => {
    const createSessionMutation = useCreateSession();

    const handleRepositorySelect = async (repository: Repository) => {
      try {
        await createSessionMutation.mutateAsync({ repository });
      } catch (_error) {
        Alert.alert('Error', 'Failed to create session. Please try again.', [{ text: 'OK' }]);
      }
    };

    const renderRepository = ({ item }: { item: Repository }) => (
      <RepositoryItem
        repository={item}
        onPress={handleRepositorySelect}
        isCreating={createSessionMutation.isPending}
      />
    );

    const renderEmptyState = () => (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-gray-500 dark:text-gray-400 text-lg text-center mb-2">
          No repositories found
        </Text>
        <Text className="text-gray-400 dark:text-gray-500 text-center">
          Make sure your repositories directory is configured
        </Text>
        {onRefresh && (
          <Pressable onPress={onRefresh} className="mt-4 bg-blue-500 px-4 py-2 rounded-lg">
            <Text className="text-white font-medium">Refresh</Text>
          </Pressable>
        )}
      </View>
    );

    const renderErrorState = () => (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-red-500 text-center text-lg mb-4">Failed to load repositories</Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
          {error?.message || 'An unexpected error occurred'}
        </Text>
        {onRefresh && (
          <Pressable onPress={onRefresh} className="bg-blue-500 px-4 py-2 rounded-lg">
            <Text className="text-white font-medium">Try Again</Text>
          </Pressable>
        )}
      </View>
    );

    if (error) {
      return renderErrorState();
    }

    if (isLoading && repositories.length === 0) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 dark:text-gray-400 mt-4">Loading repositories...</Text>
        </View>
      );
    }

    if (repositories.length === 0) {
      return renderEmptyState();
    }

    return (
      <View className="flex-1">
        <FlatList
          data={repositories}
          keyExtractor={(item) => item.path}
          renderItem={renderRepository}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={onRefresh}
          extraData={createSessionMutation.isPending}
        />
      </View>
    );
  }
);
