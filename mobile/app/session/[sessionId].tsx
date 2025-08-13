import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { ChildMessageBottomSheet } from '../../src/components/session/ChildMessageBottomSheet';
import { MessageInput } from '../../src/components/session/MessageInput';
import { MessageList } from '../../src/components/session/MessageList';
import { SessionLoadingState } from '../../src/components/session/SessionLoadingState';
import { SlashCommandBottomSheet } from '../../src/components/session/SlashCommandBottomSheet';
import { SafeAreaView } from '../../src/components/shared/SafeAreaView';
import { useSessionMessages } from '../../src/hooks/useSessionMessages';
import { useSlashCommands } from '../../src/hooks/useSlashCommands';
import type { Message } from '../../src/types/messages';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const { messages, isLoading, error, sendMessage, isSending, isWorking } = useSessionMessages(
    sessionId ?? ''
  );

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
  const childMessageBottomSheetRef = useRef<BottomSheetModal>(null);
  const slashCommandBottomSheetRef = useRef<BottomSheetModal>(null);
  const messageInputRef = useRef<{ insertCommand: (params: { commandName: string }) => void }>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Bottom sheet handlers
  const handleShowChildMessages = (message: Message) => {
    setSelectedMessage(message);
    childMessageBottomSheetRef.current?.present();
  };

  const handleCloseChildMessageBottomSheet = () => {
    childMessageBottomSheetRef.current?.dismiss();
    setSelectedMessage(null);
  };

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

  // Get the last child message of the last message
  const lastChildMessage = React.useMemo(() => {
    if (!messages || messages.length === 0) return undefined;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.children || lastMessage.children.length === 0) return undefined;

    return lastMessage.children[lastMessage.children.length - 1];
  }, [messages]);

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
            onShowChildMessages={handleShowChildMessages}
          />
          <SessionLoadingState isWorking={isWorking} childMessage={lastChildMessage} />
          <MessageInput
            ref={messageInputRef}
            sessionId={sessionId}
            onSendMessage={sendMessage}
            onShowSlashCommands={handleShowSlashCommands}
            isSending={isSending}
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Child Messages Bottom Sheet */}
      <ChildMessageBottomSheet
        ref={childMessageBottomSheetRef}
        messages={selectedMessage?.children || []}
        onClose={handleCloseChildMessageBottomSheet}
      />

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
  );
}
