import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { MessageList } from '@/components/chat/MessageList';
import { PromptInput } from '@/components/chat/PromptInput';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSessionStore } from '@/stores/sessionStore';
import { useClaudeCode } from '@/hooks/useClaudeCode';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const { 
    currentSession, 
    messages, 
    loadSession,
    isLoading: sessionLoading 
  } = useSessionStore();
  
  const sessionMessages = useMemo(() => 
    messages[sessionId] || [], 
    [messages, sessionId]
  );

  const {
    submitPrompt,
    cancelStream,
    isStreaming,
    streamingMessageId,
    isLoading: promptLoading,
  } = useClaudeCode({
    sessionId,
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId).catch((error) => {
        Alert.alert('Error', 'Failed to load session');
        router.back();
      });
    }
  }, [sessionId]);

  const handleToolClick = (tool: any) => {
    // Handle tool click - could navigate to file viewer, show details, etc.
    console.log('Tool clicked:', tool);
  };

  const handleFileClick = (path: string) => {
    // Navigate to file viewer
    router.push(`/files/${encodeURIComponent(path)}?sessionId=${sessionId}`);
  };

  if (sessionLoading && !currentSession) {
    return <LoadingState text="Loading session..." fullScreen />;
  }

  return (
    <SafeAreaView edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <MessageList
          messages={sessionMessages}
          isStreaming={isStreaming}
          streamingMessageId={streamingMessageId}
          onToolClick={handleToolClick}
          onFileClick={handleFileClick}
        />
        
        <PromptInput
          onSubmit={submitPrompt}
          isLoading={promptLoading || isStreaming}
          onCancel={isStreaming ? cancelStream : undefined}
          placeholder="Ask Claude to help with your code..."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});