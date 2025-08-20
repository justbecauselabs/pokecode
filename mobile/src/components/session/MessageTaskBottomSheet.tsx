import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { AssistantMessageToolResult } from '@pokecode/api';
import { forwardRef, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { Message } from '../../types/messages';
import { CustomBottomSheet } from '../common';
import { MessageList } from './MessageList';

interface MessageTaskBottomSheetProps {
  agentName: string;
  messages: Message[];
  onMessageLongPress?: (message: Message) => void;
  onToolResultPress?: (result: AssistantMessageToolResult) => void;
  onClose: () => void;
}

export const MessageTaskBottomSheet = forwardRef<BottomSheetModal, MessageTaskBottomSheetProps>(
  ({ agentName, messages, onMessageLongPress, onToolResultPress, onClose }, ref) => {
    // Keep snap points in case we want to customize later
    const snapPoints = useMemo(() => ['50%', '90%'], []);

    const renderContent = () => {
      if (messages.length === 0) {
        return (
          <View className="justify-center items-center py-8">
            <Text className="text-center text-muted-foreground font-mono">
              No messages from {agentName}
            </Text>
          </View>
        );
      }

      return (
        <MessageList
          messages={messages}
          isLoading={false}
          error={null}
          onMessageLongPress={onMessageLongPress}
          onToolResultPress={onToolResultPress}
          showAllMessages={true}
        />
      );
    };

    return (
      <CustomBottomSheet ref={ref} onClose={onClose} snapPoints={snapPoints}>
        <View className="flex-1 px-4">
          {/* Header */}
          <View className="py-3 border-b border-border mb-3">
            <Text className="text-lg font-semibold text-center text-foreground font-mono">
              {agentName} Messages
            </Text>
            <Text className="text-sm text-center text-muted-foreground mt-1 font-mono">
              {messages.length} messages from task agent
            </Text>
          </View>

          {/* Messages list */}
          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </BottomSheetScrollView>
        </View>
      </CustomBottomSheet>
    );
  }
);

MessageTaskBottomSheet.displayName = 'MessageTaskBottomSheet';
