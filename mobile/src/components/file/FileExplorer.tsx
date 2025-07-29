import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SectionList,
  RefreshControl,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { FileNode } from '@/types/api';
import { Card } from '../ui/Card';
import { LoadingState } from '../ui/LoadingState';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface FileExplorerProps {
  sessionId: string;
  currentPath: string;
  files: FileNode[];
  isLoading: boolean;
  onFileSelect: (file: FileNode) => void;
  onDirectoryChange: (path: string) => void;
  onRefresh?: () => void;
  recentFiles?: string[];
}

interface FileItemProps {
  file: FileNode;
  level: number;
  onPress: () => void;
  onLongPress?: () => void;
}

const FileItem: React.FC<FileItemProps> = ({ file, level, onPress, onLongPress }) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    if (file.type === 'directory') {
      setExpanded(!expanded);
      rotation.value = withSpring(expanded ? 0 : 90);
    }
    onPress();
  };

  const getFileIcon = () => {
    if (file.type === 'directory') {
      return expanded ? '📂' : '📁';
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'js': '📜',
      'jsx': '⚛️',
      'ts': '📘',
      'tsx': '⚛️',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🎨',
      'pdf': '📕',
      'zip': '🗜️',
      'mp4': '🎬',
      'mp3': '🎵',
    };
    
    return iconMap[ext || ''] || '📄';
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.fileItem,
            { paddingLeft: theme.spacing.md + (level * theme.spacing.md) },
          ]}
        >
          <View style={styles.fileInfo}>
            {file.type === 'directory' && (
              <Animated.Text style={[styles.chevron, animatedStyle]}>
                ›
              </Animated.Text>
            )}
            <Text style={styles.fileIcon}>{getFileIcon()}</Text>
            <Text
              style={[
                styles.fileName,
                { color: theme.colors.text },
                theme.typography.body,
              ]}
              numberOfLines={1}
            >
              {file.name}
            </Text>
          </View>
          {file.size && (
            <Text
              style={[
                styles.fileSize,
                { color: theme.colors.textSecondary },
                theme.typography.caption,
              ]}
            >
              {formatFileSize(file.size)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      
      {expanded && file.children && (
        <View>
          {file.children.map((child) => (
            <FileItem
              key={child.path}
              file={child}
              level={level + 1}
              onPress={() => onPress()}
              onLongPress={onLongPress}
            />
          ))}
        </View>
      )}
    </>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  sessionId,
  currentPath,
  files,
  isLoading,
  onFileSelect,
  onDirectoryChange,
  onRefresh,
  recentFiles = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    
    const query = searchQuery.toLowerCase();
    return filterFiles(files, query);
  }, [files, searchQuery]);

  const sections = useMemo(() => {
    const sectionData: Array<{
      title: string;
      data: FileNode[];
    }> = [];
    
    if (recentFiles.length > 0 && !searchQuery) {
      sectionData.push({
        title: 'Recent Files',
        data: recentFiles.map(path => ({
          name: path.split('/').pop() || path,
          path,
          type: 'file' as const,
        })),
      });
    }
    
    sectionData.push({
      title: 'Files',
      data: filteredFiles,
    });
    
    return sectionData;
  }, [recentFiles, filteredFiles, searchQuery]);

  const handleFilePress = (file: FileNode) => {
    if (file.type === 'directory') {
      onDirectoryChange(file.path);
    } else {
      onFileSelect(file);
    }
  };

  const handleFileLongPress = (file: FileNode) => {
    Alert.alert(
      file.name,
      'What would you like to do?',
      [
        {
          text: 'Open',
          onPress: () => handleFilePress(file),
        },
        {
          text: 'Copy Path',
          onPress: () => {
            // Copy path to clipboard
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pathComponents = currentPath.split('/').filter(Boolean);

  if (isLoading) {
    return <LoadingState text="Loading files..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={() => onDirectoryChange('/')}>
            <Text style={[styles.breadcrumbItem, { color: theme.colors.primary }]}>
              /
            </Text>
          </TouchableOpacity>
          {pathComponents.map((component, index) => {
            const path = '/' + pathComponents.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={path}>
                <Text style={[styles.breadcrumbSeparator, { color: theme.colors.textSecondary }]}>
                  {' › '}
                </Text>
                <TouchableOpacity onPress={() => onDirectoryChange(path)}>
                  <Text style={[styles.breadcrumbItem, { color: theme.colors.primary }]}>
                    {component}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
        
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder="Search files..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <FileItem
            file={item}
            level={0}
            onPress={() => handleFilePress(item)}
            onLongPress={() => handleFileLongPress(item)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              {section.title}
            </Text>
          </View>
        )}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

function filterFiles(files: FileNode[], query: string): FileNode[] {
  const results: FileNode[] = [];
  
  for (const file of files) {
    if (file.name.toLowerCase().includes(query)) {
      results.push(file);
    } else if (file.children) {
      const filteredChildren = filterFiles(file.children, query);
      if (filteredChildren.length > 0) {
        results.push({
          ...file,
          children: filteredChildren,
        });
      }
    }
  }
  
  return results;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    fontSize: 14,
    fontWeight: '600',
  },
  breadcrumbSeparator: {
    fontSize: 14,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingRight: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    marginRight: 4,
    width: 20,
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  fileName: {
    flex: 1,
  },
  fileSize: {
    marginLeft: 8,
  },
});