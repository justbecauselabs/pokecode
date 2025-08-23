import type { DirectoryItem } from '@pokecode/api';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useDirectoryBrowser } from '@/hooks/useDirectoryBrowser';

interface FileExplorerProps {
  initialPath?: string;
  onSelectPath: (path: string) => void;
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
      className="flex-row items-center py-4 px-4 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-base font-semibold text-foreground font-mono mr-2">
            📁 {item.name}
          </Text>
          {isGitRepo && (
            <View className="bg-primary px-2 py-1 rounded">
              <Text className="text-primary-foreground text-xs font-medium font-mono">Git</Text>
            </View>
          )}
        </View>
      </View>
      <Text className="text-muted-foreground text-lg font-mono">›</Text>
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
    <View className="px-4 py-2 bg-background border-b border-border">
      <Text className="text-sm text-muted-foreground font-mono" numberOfLines={1}>
        📁 {displayPath}
      </Text>
    </View>
  );
});

export const FileExplorer = memo(({ initialPath, onSelectPath }: FileExplorerProps) => {
  const router = useRouter();
  const {
    currentPath,
    parentPath,
    directories,
    isLoading,
    error,
    refetch,
  } = useDirectoryBrowser(initialPath);

  const handleDirectoryPress = (path: string) => {
    // Push a new FileExplorer screen with the selected path
    router.push({
      pathname: '/file-explorer',
      params: { path }
    });
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
      {/* Breadcrumb Path */}
      <BreadcrumbPath path={currentPath} />

      {/* Parent Directory Option */}
      {parentPath && (
        <Pressable
          onPress={() => router.push({
            pathname: '/file-explorer',
            params: { path: parentPath }
          })}
          className="flex-row items-center py-4 px-4 active:opacity-80 border-b border-border"
        >
          <Text className="text-base text-muted-foreground font-mono mr-2">📁 ..</Text>
          <Text className="text-muted-foreground font-mono">Parent Directory</Text>
          <View className="flex-1" />
          <Text className="text-muted-foreground text-lg font-mono">›</Text>
        </Pressable>
      )}
    </>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-muted-foreground text-lg text-center mb-2 font-mono">
        No directories found
      </Text>
      <Text className="text-muted-foreground/70 text-center mb-4 font-mono">
        This directory doesn't contain any subdirectories
      </Text>
      <Pressable onPress={handleUseCurrentPath} className="bg-primary px-6 py-3 rounded-lg">
        <Text className="text-primary-foreground font-medium font-mono">Use This Directory</Text>
      </Pressable>
    </View>
  );

  const renderErrorState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-destructive text-center text-lg mb-4 font-mono">Unable to access directory</Text>
      <Text className="text-muted-foreground text-center mb-4 font-mono">
        {error?.message || 'Permission denied or directory not found'}
      </Text>
      <Pressable onPress={() => refetch()} className="bg-primary px-4 py-2 rounded-lg">
        <Text className="text-primary-foreground font-medium font-mono">Try Again</Text>
      </Pressable>
    </View>
  );

  const renderBottomBar = () => (
    <View className="p-4 bg-background border-t border-border">
      <Pressable
        onPress={handleUseCurrentPath}
        disabled={!currentPath}
        className={`py-3 px-6 rounded-lg w-full items-center ${
          currentPath ? 'bg-primary active:opacity-80' : 'bg-muted opacity-50'
        }`}
      >
        <Text className={`font-mono font-medium ${
          currentPath ? 'text-primary-foreground' : 'text-muted-foreground'
        }`}>
          Select Directory
        </Text>
      </Pressable>
    </View>
  );

  if (error) {
    return (
      <View className="flex-1 bg-background">
        {renderHeader()}
        {renderErrorState()}
        {renderBottomBar()}
      </View>
    );
  }

  if (isLoading && !directories.length) {
    return (
      <View className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#528bff" />
          <Text className="text-muted-foreground mt-4 font-mono">Loading directories...</Text>
        </View>
        {renderBottomBar()}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={directories}
        keyExtractor={(item) => item.path}
        renderItem={renderDirectory}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View className="h-px bg-border ml-4" />}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={refetch}
        stickyHeaderIndices={[0]} // Make header sticky
      />
      {renderBottomBar()}
    </View>
  );
});
