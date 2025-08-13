import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from '../../src/components/common';
import { MessageInput } from '../../src/components/session/MessageInput';
import { MessageList } from '../../src/components/session/MessageList';
import { SlashCommandBottomSheet } from '../../src/components/session/SlashCommandBottomSheet';
import { useSessionMessages } from '../../src/hooks/useSessionMessages';
import { useSlashCommands } from '../../src/hooks/useSlashCommands';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const { messages, session, isLoading, error, sendMessage, isSending, isWorking } =
    useSessionMessages(sessionId ?? '');

  // Fetch slash commands
  const {
    data: commandsData,
    isLoading: isLoadingCommands,
    error: commandsError,
  } = useSlashCommands({
    sessionId: sessionId ?? '',
    enabled: !!sessionId,
  });

  // Bottom sheet refs and state
  const slashCommandBottomSheetRef = useRef<BottomSheetModal>(null);
  const messageInputRef = useRef<{ insertCommand: (params: { commandName: string }) => void }>(
    null
  );

  // Slash command handlers
  const handleShowSlashCommands = () => {
    slashCommandBottomSheetRef.current?.present();
  };

  const handleCloseSlashCommandBottomSheet = () => {
    slashCommandBottomSheetRef.current?.dismiss();
  };

  const handleSelectSlashCommand = (params: { commandName: string }) => {
    messageInputRef.current?.insertCommand({ commandName: params.commandName });
  };


  if (!sessionId) {
    return (
      <SafeAreaView className="bg-background">
        <View className="flex-1 justify-center items-center bg-background">
          <Text className="text-destructive text-lg font-mono">Invalid session ID</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: session?.name || 'Session',
          headerTitleStyle: {
            fontWeight: '600',
            color: '#abb2bf', // One Dark Pro foreground
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          },
        }}
      />
      <SafeAreaView className="bg-background">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View className="flex-1 bg-background">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              error={error}
            />
            <MessageInput
              ref={messageInputRef}
              sessionId={sessionId}
              onSendMessage={sendMessage}
              onShowSlashCommands={handleShowSlashCommands}
              isSending={isSending || isWorking}
              disabled={isLoading}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Slash Commands Bottom Sheet */}
        <SlashCommandBottomSheet
          ref={slashCommandBottomSheetRef}
          commands={commandsData?.commands || []}
          isLoading={isLoadingCommands}
          error={commandsError}
          onSelectCommand={handleSelectSlashCommand}
          onClose={handleCloseSlashCommandBottomSheet}
        />
      </SafeAreaView>
    </>
  );
}
