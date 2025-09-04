import type { DirectoryItem } from '@pokecode/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useDirectoryBrowser } from '@/hooks/useDirectoryBrowser';
import { Row } from '@/components/common/Row';

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
  if (!path) {
    return null;
  }

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
  const params = useLocalSearchParams<{ path?: string; showHidden?: string | string[] }>();
  const parseBoolParam = (value: string | string[] | undefined): boolean => {
    if (Array.isArray(value)) {
      return value.length > 0 && (value[0] === '1' || value[0] === 'true');
    }
    return value === '1' || value === 'true';
  };
  const [showHidden, setShowHidden] = useState<boolean>(parseBoolParam(params.showHidden));
  const {
    currentPath,
    parentPath,
    directories,
    isLoading,
    error,
    refetch,
  } = useDirectoryBrowser(initialPath);

  const visibleDirectories = useMemo(() => {
    return directories.filter((dir) => (showHidden ? true : !dir.name.startsWith('.')));
  }, [directories, showHidden]);

  const handleDirectoryPress = (path: string) => {
    // Push a new FileExplorer screen with the selected path
    router.push({
      pathname: '/file-explorer',
      params: { path, showHidden: showHidden ? '1' : '0' }
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
            params: { path: parentPath, showHidden: showHidden ? '1' : '0' }
          })}
          className="flex-row items-center py-4 px-4 active:opacity-80 border-b border-border"
        >
          <Text className="text-base text-muted-foreground font-mono mr-2">📁 ..</Text>
          <Text className="text-muted-foreground font-mono">Parent Directory</Text>
          <View className="flex-1" />
          <Text className="text-muted-foreground text-lg font-mono">›</Text>
        </Pressable>
      )}

      {/* Hidden files toggle */}
      <Row
        title="Show hidden items"
        className="border-b border-border"
        leading={{ type: 'icon', library: 'Feather', name: 'eye-off', color: '#666' }}
        trailing={{
          type: 'switch',
          value: showHidden,
          onValueChange: (value: boolean) => {
            setShowHidden(value);
            router.setParams({ showHidden: value ? '1' : '0' });
          },
        }}
      />
    </>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-muted-foreground text-lg text-center mb-2 font-mono">
        {showHidden ? 'No directories found' : 'No visible directories'}
      </Text>
      <Text className="text-muted-foreground/70 text-center mb-4 font-mono">
        {showHidden
          ? "This directory doesn't contain any subdirectories"
          : 'Hidden folders are currently hidden. Toggle “Show hidden files” above.'}
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
        data={visibleDirectories}
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
