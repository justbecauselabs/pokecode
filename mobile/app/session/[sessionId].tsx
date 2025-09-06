import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { AssistantMessageToolResult } from '@pokecode/api';
import { CLAUDE_MODELS, type ClaudeModel } from '@pokecode/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from '../../src/components/common';
import { AgentSelectionBottomSheet } from '../../src/components/session/AgentSelectionBottomSheet';
import { MessageDebugBottomSheet } from '../../src/components/session/MessageDebugBottomSheet';
import { MessageInput, type MessageInputRef } from '../../src/components/session/MessageInput';
import { MessageList } from '../../src/components/session/MessageList';
import { MessageTaskBottomSheet } from '../../src/components/session/MessageTaskBottomSheet';
import { ModelSelectionBottomSheet } from '../../src/components/session/ModelSelectionBottomSheet';
import { SlashCommandBottomSheet } from '../../src/components/session/SlashCommandBottomSheet';
import { ToolResultBottomSheet } from '../../src/components/session/ToolResultBottomSheet';
import { useAgents } from '../../src/hooks/useAgents';
import { useSessionMessages } from '../../src/hooks/useSessionMessages';
import { useSlashCommands } from '../../src/hooks/useSlashCommands';
import { useDefaultModel } from '../../src/stores/settingsStore';
import type { Message } from '../../src/types/messages';

export default function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const {
    messages,
    session: messageSession,
    isLoading,
    error,
    sendMessage,
    cancelSession,
    isSending,
    isCancelling,
    isWorking,
  } = useSessionMessages(sessionId ?? '');

  // Session data is now included in messages endpoint response (messageSession)
  // Contains full session details including messageCount and tokenCount

  // Fetch slash commands
  const {
    data: commandsData,
    isLoading: isLoadingCommands,
    error: commandsError,
  } = useSlashCommands({
    sessionId: sessionId ?? '',
    enabled: !!sessionId,
  });

  // Fetch agents for color mapping
  const {
    data: agentsData,
    isLoading: isLoadingAgents,
    error: agentsError,
  } = useAgents({
    sessionId: sessionId ?? '',
    query: { type: 'all' },
  });

  // Create agent name to color dictionary
  const agentColors =
    agentsData?.agents?.reduce(
      (acc, agent) => {
        if (agent.color) {
          acc[agent.name] = agent.color;
        }
        return acc;
      },
      {} as Record<string, string>,
    ) || {};

  // Bottom sheet refs and state
  const slashCommandBottomSheetRef = useRef<BottomSheetModal>(null);
  const agentSelectionBottomSheetRef = useRef<BottomSheetModal>(null);
  const modelSelectionBottomSheetRef = useRef<BottomSheetModal>(null);
  const toolResultBottomSheetRef = useRef<BottomSheetModal>(null);
  const taskBottomSheetRef = useRef<BottomSheetModal>(null);
  const messageInputRef = useRef<MessageInputRef>(null);

  // Debug state
  const [debugMessage, setDebugMessage] = useState<Message | null>(null);
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  // Tool result state
  const [toolResult, setToolResult] = useState<AssistantMessageToolResult | null>(null);

  // Task bottom sheet data
  const [taskBottomSheetData, setTaskBottomSheetData] = useState<{
    agentName: string;
    messages: Message[];
  }>({
    agentName: '',
    messages: [],
  });

  // Selected agents state
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Model selection state
  const defaultModel = useDefaultModel();
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>(defaultModel as ClaudeModel);

  // Slash command handlers
  const handleShowSlashCommands = () => {
    Keyboard.dismiss();
    slashCommandBottomSheetRef.current?.present();
  };

  const handleCloseSlashCommandBottomSheet = () => {
    slashCommandBottomSheetRef.current?.dismiss();
  };

  const handleSelectSlashCommand = (params: { commandName: string }) => {
    messageInputRef.current?.insertCommand({ commandName: params.commandName });
  };

  // Agent selection handlers
  const handleShowAgents = () => {
    Keyboard.dismiss();
    agentSelectionBottomSheetRef.current?.present();
  };

  const handleCloseAgentSelectionBottomSheet = () => {
    agentSelectionBottomSheetRef.current?.dismiss();
  };

  const handleToggleAgent = (params: { agentName: string }) => {
    setSelectedAgents((prev) => {
      if (prev.includes(params.agentName)) {
        return prev.filter((name) => name !== params.agentName);
      } else {
        return [...prev, params.agentName];
      }
    });
  };

  // Model selection handlers
  const handleShowModels = () => {
    Keyboard.dismiss();
    modelSelectionBottomSheetRef.current?.present();
  };

  const handleCloseModelSelectionBottomSheet = () => {
    modelSelectionBottomSheetRef.current?.dismiss();
  };

  const handleSelectModel = (params: { modelId: string }) => {
    setSelectedModel(params.modelId as ClaudeModel);
    modelSelectionBottomSheetRef.current?.dismiss();
  };

  // Message debug handlers
  const handleMessageLongPress = (message: Message) => {
    console.log('Long press detected on message:', message.id);
    setDebugMessage(message);
    setIsDebugVisible(true);
  };

  // Close debug sheet
  const handleCloseDebug = () => {
    setIsDebugVisible(false);
    setDebugMessage(null);
  };

  // Tool result handlers
  const handleToolResultPress = (result: AssistantMessageToolResult) => {
    setToolResult(result);
    Keyboard.dismiss();
    toolResultBottomSheetRef.current?.present();
  };

  // Task tool handlers
  const handleTaskToolPress = (_toolId: string, agentName: string, taskMessages: Message[]) => {
    setTaskBottomSheetData({ agentName, messages: taskMessages });
    Keyboard.dismiss();
    taskBottomSheetRef.current?.present();
  };

  // Gesture to dismiss keyboard on downward swipe
  const swipeGesture = Gesture.Pan().onUpdate(({ velocityY, translationY }) => {
    if (velocityY > 500 && translationY > 50) {
      Keyboard.dismiss();
    }
  });

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
          headerRight: () => (
            <Text
              className="text-primary font-mono"
              onPress={() =>
                router.push({ pathname: '/session/[sessionId]/git-changes', params: { sessionId } })
              }
            >
              Diff
            </Text>
          ),
          headerTitleStyle: {
            fontWeight: '600',
            color: '#abb2bf', // Using design token equivalent of text-foreground
            fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
          },
        }}
      />
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <GestureDetector gesture={swipeGesture}>
            <Animated.View className="flex-1 bg-background">
              <View className="flex-1">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  error={error}
                  onMessageLongPress={handleMessageLongPress}
                  onToolResultPress={handleToolResultPress}
                  onTaskToolPress={handleTaskToolPress}
                  agentColors={agentColors}
                />
              </View>
              <MessageInput
                ref={messageInputRef}
                sessionId={sessionId}
                session={messageSession ?? undefined} // Now includes full session data from messages endpoint
                onSendMessage={sendMessage}
                onCancelSession={cancelSession}
                onShowSlashCommands={handleShowSlashCommands}
                onShowAgents={handleShowAgents}
                onShowModels={handleShowModels}
                selectedAgents={selectedAgents}
                selectedModel={selectedModel}
                isSending={isSending}
                isWorking={isWorking}
                isCancelling={isCancelling}
                disabled={isLoading}
              />
            </Animated.View>
          </GestureDetector>
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

        {/* Agent Selection Bottom Sheet */}
        <AgentSelectionBottomSheet
          ref={agentSelectionBottomSheetRef}
          agents={agentsData?.agents || []}
          selectedAgents={selectedAgents}
          isLoading={isLoadingAgents}
          error={agentsError}
          onToggleAgent={handleToggleAgent}
          onClose={handleCloseAgentSelectionBottomSheet}
        />

        {/* Model Selection Bottom Sheet */}
        <ModelSelectionBottomSheet
          ref={modelSelectionBottomSheetRef}
          models={[...CLAUDE_MODELS]}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          onClose={handleCloseModelSelectionBottomSheet}
        />

        {/* Message Debug Bottom Sheet */}
        <MessageDebugBottomSheet
          message={debugMessage}
          isVisible={isDebugVisible}
          onClose={handleCloseDebug}
        />

        {/* Tool Result Bottom Sheet */}
        <ToolResultBottomSheet
          ref={toolResultBottomSheetRef}
          result={toolResult}
          onClose={() => toolResultBottomSheetRef.current?.dismiss()}
        />

        {/* Task Messages Bottom Sheet */}
        <MessageTaskBottomSheet
          ref={taskBottomSheetRef}
          agentName={taskBottomSheetData.agentName}
          messages={taskBottomSheetData.messages}
          onMessageLongPress={handleMessageLongPress}
          onToolResultPress={handleToolResultPress}
          onClose={() => taskBottomSheetRef.current?.dismiss()}
        />
      </SafeAreaView>
    </>
  );
}
