import type { DirectoryItem } from '@pokecode/api';
import { memo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useDirectoryBrowser } from '@/hooks/useDirectoryBrowser';

interface FileExplorerProps {
  onSelectPath: (path: string) => void;
  onCancel: () => void;
}

interface DirectoryItemProps {
  item: DirectoryItem;
  onPress: (path: string) => void;
}

const DirectoryItemComponent = memo(({ item, onPress }: DirectoryItemProps) => {
  const isGitRepo = item.isGitRepository;

  return (
    <Pressable
      onPress={() => onPress(item.path)}
      className="flex-row items-center py-4 px-4 active:bg-gray-50 dark:active:bg-gray-700"
    >
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-lg font-medium text-gray-900 dark:text-white mr-2">
            📁 {item.name}
          </Text>
          {isGitRepo && (
            <View className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
              <Text className="text-green-700 dark:text-green-300 text-xs font-medium">Git</Text>
            </View>
          )}
        </View>
      </View>
      <Text className="text-gray-400 dark:text-gray-500 text-lg">›</Text>
    </Pressable>
  );
});

const BreadcrumbPath = memo(({ path }: { path?: string }) => {
  if (!path) return null;

  // Show last 2-3 path segments to keep it readable
  const segments = path.split('/').filter(Boolean);
  const displaySegments = segments.length > 3 ? ['...', ...segments.slice(-2)] : segments;

  const displayPath = `/${displaySegments.join('/')}`;

  return (
    <View className="px-4 py-2 bg-gray-50 dark:bg-gray-800">
      <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
        📁 {displayPath}
      </Text>
    </View>
  );
});

export const FileExplorer = memo(({ onSelectPath, onCancel }: FileExplorerProps) => {
  const {
    currentPath,
    parentPath,
    directories,
    isLoading,
    error,
    navigateToDirectory,
    navigateToParent,
    refetch,
  } = useDirectoryBrowser();

  const handleDirectoryPress = (path: string) => {
    navigateToDirectory(path);
  };

  const handleUseCurrentPath = () => {
    if (currentPath) {
      onSelectPath(currentPath);
    } else {
      Alert.alert('Error', 'No directory selected');
    }
  };

  const renderDirectory = ({ item }: { item: DirectoryItem }) => (
    <DirectoryItemComponent item={item} onPress={handleDirectoryPress} />
  );

  const renderHeader = () => (
    <>
      {/* Navigation Header */}
      <View className="flex-row items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <Pressable
          onPress={onCancel}
          className="py-2 px-4 active:bg-gray-100 dark:active:bg-gray-700 rounded"
        >
          <Text className="text-blue-500 font-medium">Cancel</Text>
        </Pressable>

        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Directory
        </Text>

        <Pressable
          onPress={handleUseCurrentPath}
          disabled={!currentPath}
          className={`py-2 px-4 rounded ${
            currentPath ? 'bg-blue-500 active:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <Text className={currentPath ? 'text-white font-medium' : 'text-gray-500'}>Select</Text>
        </Pressable>
      </View>

      {/* Breadcrumb Path */}
      <BreadcrumbPath path={currentPath} />

      {/* Parent Directory Option */}
      {parentPath && (
        <Pressable
          onPress={navigateToParent}
          className="flex-row items-center py-4 px-4 active:bg-gray-50 dark:active:bg-gray-700 border-b border-gray-100 dark:border-gray-700"
        >
          <Text className="text-lg text-gray-600 dark:text-gray-400 mr-2">📁 ..</Text>
          <Text className="text-gray-600 dark:text-gray-400">Parent Directory</Text>
          <View className="flex-1" />
          <Text className="text-gray-400 dark:text-gray-500 text-lg">›</Text>
        </Pressable>
      )}
    </>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-gray-500 dark:text-gray-400 text-lg text-center mb-2">
        No directories found
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-center mb-4">
        This directory doesn't contain any subdirectories
      </Text>
      <Pressable onPress={handleUseCurrentPath} className="bg-blue-500 px-6 py-3 rounded-lg">
        <Text className="text-white font-medium">Use This Directory</Text>
      </Pressable>
    </View>
  );

  const renderErrorState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-red-500 text-center text-lg mb-4">Unable to access directory</Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
        {error?.message || 'Permission denied or directory not found'}
      </Text>
      <Pressable onPress={() => refetch()} className="bg-blue-500 px-4 py-2 rounded-lg">
        <Text className="text-white font-medium">Try Again</Text>
      </Pressable>
    </View>
  );

  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900">
        {renderHeader()}
        {renderErrorState()}
      </View>
    );
  }

  if (isLoading && !directories.length) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900">
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-500 dark:text-gray-400 mt-4">Loading directories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={directories}
        keyExtractor={(item) => item.path}
        renderItem={renderDirectory}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={refetch}
        stickyHeaderIndices={[0]} // Make header sticky
      />
    </View>
  );
});
