import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { FileExplorer } from '@/components/file/FileExplorer';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSessionStore } from '@/stores/sessionStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { FileNode } from '@/types/api';

export default function FilesScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const { currentSession, sessions } = useSessionStore();
  const [currentPath, setCurrentPath] = useState('/');
  
  // Use current session or first available session
  const activeSessionId = sessionId || currentSession?.id || sessions[0]?.id;
  
  const fileSystem = useFileSystem(activeSessionId || '');
  const { data: files, isLoading, refetch } = fileSystem.useFileList(currentPath);

  const handleFileSelect = (file: FileNode) => {
    if (file.type === 'file') {
      router.push(`/files/${encodeURIComponent(file.path)}?sessionId=${activeSessionId}`);
    }
  };

  const handleDirectoryChange = (path: string) => {
    setCurrentPath(path);
  };

  if (!activeSessionId) {
    return (
      <SafeAreaView>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No active session
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
            Please select or create a project first
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <FileExplorer
        sessionId={activeSessionId}
        currentPath={currentPath}
        files={files || []}
        isLoading={isLoading}
        onFileSelect={handleFileSelect}
        onDirectoryChange={handleDirectoryChange}
        onRefresh={refetch}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});