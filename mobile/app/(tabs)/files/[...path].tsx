import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { CodeViewer } from '@/components/code/CodeViewer';
import { LoadingState } from '@/components/ui/LoadingState';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

export default function FileViewerScreen() {
  const { path, sessionId } = useLocalSearchParams<{ path: string[]; sessionId: string }>();
  const router = useRouter();
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const filePath = useMemo(() => {
    if (!path) return '';
    return Array.isArray(path) ? path.join('/') : path;
  }, [path]);

  const fileName = useMemo(() => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  }, [filePath]);

  const fileSystem = useFileSystem(sessionId);
  const { data, isLoading, error } = fileSystem.useFileContent(filePath);

  const handleEdit = () => {
    Alert.alert(
      'Edit File',
      'File editing is not yet implemented in the mobile app. Please use the web version for editing.',
      [{ text: 'OK' }]
    );
  };

  if (isLoading) {
    return <LoadingState text="Loading file..." fullScreen />;
  }

  if (error) {
    return (
      <SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Failed to load file
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: fileName }} />
      <SafeAreaView>
        <ScrollView style={styles.container}>
          <CodeViewer
            code={data?.content || ''}
            language={data?.language || fileSystem.getFileLanguage(fileName)}
            filename={fileName}
            onEdit={handleEdit}
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});