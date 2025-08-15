import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from '../../src/components/common';
import { MessageDebugBottomSheet } from '../../src/components/session/MessageDebugBottomSheet';
import { MessageInput, type MessageInputRef } from '../../src/components/session/MessageInput';
import { MessageList } from '../../src/components/session/MessageList';
import { SlashCommandBottomSheet } from '../../src/components/session/SlashCommandBottomSheet';
import { useSessionMessages } from '../../src/hooks/useSessionMessages';
import { useSession } from '../../src/hooks/useSessions';
import { useSlashCommands } from '../../src/hooks/useSlashCommands';
import type { Message } from '../../src/types/messages';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const {
    messages,
    session: messageSession,
    isLoading,
    error,
    sendMessage,
    isSending,
    isWorking,
  } = useSessionMessages(sessionId ?? '');

  // Fetch full session data for counts
  const { data: fullSession } = useSession(sessionId ?? '');

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
  
  // Debug state
  const [debugMessage, setDebugMessage] = useState<Message | null>(null);
  const [isDebugVisible, setIsDebugVisible] = useState(false);

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

  // Message debug handlers
  const handleMessageLongPress = (message: Message) => {
    console.log('Long press detected on message:', message.id);
    setDebugMessage(message);
    setIsDebugVisible(true);
  };

  // Test debug button
  const handleTestDebug = () => {
    console.log('Test debug button pressed, messages count:', messages.length);
    if (messages.length > 0) {
      setDebugMessage(messages[0]);
      setIsDebugVisible(true);
    }
  };

  // Close debug sheet
  const handleCloseDebug = () => {
    setIsDebugVisible(false);
    setDebugMessage(null);
  };

  // Gesture handler for swipe to dismiss keyboard
  const handleSwipeGesture = (event: {
    nativeEvent: { velocityY: number; translationY: number };
  }) => {
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
          title: messageSession?.name || 'Session',
          headerTitleStyle: {
            fontWeight: '600',
            color: '#abb2bf', // One Dark Pro foreground
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          },
          headerRight: () => (
            <TouchableOpacity onPress={handleTestDebug} className="mr-4">
              <Text className="text-foreground text-lg">🐛</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView className="bg-background">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <PanGestureHandler onGestureEvent={handleSwipeGesture}>
              <Animated.View className="flex-1 bg-background">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  error={error}
                  onMessageLongPress={handleMessageLongPress}
                />
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                  <View>
                    <MessageInput
                      ref={messageInputRef}
                      sessionId={sessionId}
                      session={fullSession}
                      onSendMessage={sendMessage}
                      onShowSlashCommands={handleShowSlashCommands}
                      isSending={isSending || isWorking}
                      disabled={isLoading}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </Animated.View>
            </PanGestureHandler>
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

        {/* Message Debug Bottom Sheet */}
        <MessageDebugBottomSheet 
          message={debugMessage}
          isVisible={isDebugVisible}
          onClose={handleCloseDebug}
        />
      </SafeAreaView>
    </>
  );
}
