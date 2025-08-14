import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, Text, View, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from '../../src/components/common';
import { MessageInput, type MessageInputRef } from '../../src/components/session/MessageInput';
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
  const messageInputRef = useRef<MessageInputRef>(null);

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

  // Gesture handler for swipe to dismiss keyboard
  const handleSwipeGesture = (event: { nativeEvent: { velocityY: number; translationY: number } }) => {
    const { velocityY, translationY } = event.nativeEvent;
    
    // Dismiss keyboard on downward swipe (positive velocity and translation)
    if (velocityY > 500 && translationY > 50) {
      Keyboard.dismiss();
    }
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <PanGestureHandler onGestureEvent={handleSwipeGesture}>
              <Animated.View className="flex-1 bg-background">
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
              </Animated.View>
            </PanGestureHandler>
          </TouchableWithoutFeedback>
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
