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
      className="flex-row items-center py-4 px-4 active:opacity-80"
    >
      {/* Repository Info */}
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-base font-semibold text-foreground font-mono mr-2">
            {repository.folderName}
          </Text>
          {repository.isGitRepository && (
            <View className="bg-primary px-2 py-1 rounded">
              <Text className="text-primary-foreground text-xs font-medium font-mono">Git</Text>
            </View>
          )}
        </View>
        <Text className="text-muted-foreground text-sm font-mono" numberOfLines={1}>
          {repository.path}
        </Text>
      </View>

      {/* Loading indicator for this specific item */}
      {isCreating && (
        <View className="ml-3">
          <ActivityIndicator size="small" color="#528bff" />
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

    const renderRepository = ({ item }: { item: Repository }) => {
      // Validate repository object to prevent rendering errors
      if (!item || typeof item !== 'object' || !item.folderName || !item.path) {
        console.warn('Invalid repository item:', item);
        return null;
      }

      return (
        <RepositoryItem
          repository={item}
          onPress={handleRepositorySelect}
          isCreating={createSessionMutation.isPending}
        />
      );
    };

    const renderEmptyState = () => (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground text-lg text-center mb-2 font-mono">
          No repositories found
        </Text>
        <Text className="text-muted-foreground/70 text-center font-mono">
          Make sure your repositories directory is configured
        </Text>
        {onRefresh && (
          <Pressable onPress={onRefresh} className="mt-4 bg-primary px-4 py-2 rounded-lg">
            <Text className="text-primary-foreground font-medium font-mono">Refresh</Text>
          </Pressable>
        )}
      </View>
    );

    const renderErrorState = () => (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-destructive text-center text-lg mb-4 font-mono">
          Failed to load repositories
        </Text>
        <Text className="text-muted-foreground text-center mb-4 font-mono">
          {error?.message || 'An unexpected error occurred'}
        </Text>
        {onRefresh && (
          <Pressable onPress={onRefresh} className="bg-primary px-4 py-2 rounded-lg">
            <Text className="text-primary-foreground font-medium font-mono">Try Again</Text>
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
          <ActivityIndicator size="large" color="#528bff" />
          <Text className="text-muted-foreground mt-4 font-mono">Loading repositories...</Text>
        </View>
      );
    }

    if (repositories.length === 0) {
      return renderEmptyState();
    }

    return (
      <View className="flex-1 bg-background">
        <FlatList
          data={repositories}
          keyExtractor={(item) => item?.path || `repo-${Math.random()}`}
          renderItem={renderRepository}
          ItemSeparatorComponent={() => <View className="h-px bg-border ml-4" />}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={onRefresh}
          extraData={createSessionMutation.isPending}
        />
      </View>
    );
  },
);
