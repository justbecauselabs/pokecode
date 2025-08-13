import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { ChildMessage } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface SessionLoadingStateProps {
  isWorking: boolean;
  childMessage?: ChildMessage;
}

export function SessionLoadingState(params: SessionLoadingStateProps) {
  const { isWorking, childMessage } = params;

  if (!isWorking) return null;

  return (
    <View className="px-4 py-2 border-t border-border bg-background">
      <View className="flex-row items-center justify-center gap-2">
        <ActivityIndicator size="small" color="#528bff" />
        <Text className="text-sm text-muted-foreground font-mono">Claude is working...</Text>
      </View>
      {childMessage && (
        <View className="mt-3 p-3 bg-card border border-border rounded-lg">
          <Text className="text-xs font-medium text-muted-foreground mb-2 font-mono">
            {childMessage.role === 'user' ? 'User' : 'Assistant'}
          </Text>
          {childMessage.content.trim() ? (
            <MarkdownRenderer content={childMessage.content} />
          ) : (
            <Text className="text-muted-foreground italic text-sm font-mono">[No content]</Text>
          )}
        </View>
      )}
    </View>
  );
}
