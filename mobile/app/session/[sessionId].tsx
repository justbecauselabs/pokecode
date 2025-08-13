import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from '../../src/components/shared/SafeAreaView';
import { MessageList } from '../../src/components/session/MessageList';
import { useSessionMessages } from '../../src/hooks/useSessionMessages';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const {
    messages,
    isLoading,
    error,
    refetch,
  } = useSessionMessages(sessionId!);

  if (!sessionId) {
    return (
      <SafeAreaView>
        <View className="flex-1 justify-center items-center">
          <Text>Invalid session ID</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <MessageList
        messages={messages}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
      />
    </SafeAreaView>
  );
}