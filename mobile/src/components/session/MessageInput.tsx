import { Feather } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Keyboard, Text, type TextInput, TouchableOpacity, View } from 'react-native';
import type { SessionInfo } from '@/types/messages';
import { TextField } from '../common';

export interface MessageInputRef {
  insertCommand: (params: { commandName: string }) => void;
}

interface MessageInputProps {
  sessionId: string;
  session?: SessionInfo;
  onSendMessage: (params: { content: string }) => Promise<unknown>;
  onShowSlashCommands?: () => void;
  onShowAgents?: () => void;
  selectedAgents: string[];
  isSending?: boolean;
  disabled?: boolean;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>((props, ref) => {
  const {
    session,
    onSendMessage,
    onShowSlashCommands,
    onShowAgents,
    selectedAgents,
    isSending = false,
    disabled,
  } = props;
  const [message, setMessage] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const insertCommand = (params: { commandName: string }) => {
    setSelectedCommand(params.commandName);

    // Focus the input after selecting the command
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    insertCommand,
  }));

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || disabled) return;

    Keyboard.dismiss();

    try {
      let finalMessage = trimmedMessage;

      // Prepend selected agents if any are active
      if (selectedAgents.length > 0) {
        const agentText = selectedAgents.map(agent => `- @agent-${agent}`).join('\n');
        finalMessage = `use the following sub agents\n${agentText}\n\n${trimmedMessage}`;
      }

      // Prepend the selected command if one is active
      if (selectedCommand) {
        finalMessage = `/${selectedCommand} ${finalMessage}`;
      }

      await onSendMessage({
        content: finalMessage,
      });

      setMessage('');
      setSelectedCommand(null); // Clear the selected command after sending
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  return (
    <View className="border-t border-border bg-background p-4">
      <View className="flex-row items-end gap-3">
        <View className="flex-1">
          <TextField
            ref={inputRef}
            value={message}
            onChangeText={setMessage}
            placeholder="Enter your message..."
            multiline
            textAlignVertical="top"
            editable={!disabled && !isSending}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>

        {/* Send Button with Up Arrow */}
        <TouchableOpacity
          className={`w-8 h-8 rounded-full items-center justify-center active:opacity-70 ${
            disabled || !message.trim() || isSending ? 'bg-gray-500' : 'bg-white'
          }`}
          onPress={handleSend}
          disabled={disabled || !message.trim() || isSending}
          activeOpacity={0.7}
        >
          {isSending ? (
            <View className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Feather
              name="arrow-up"
              size={16}
              color={disabled || !message.trim() || isSending ? '#9ca3af' : '#282c34'} // Using design tokens for muted vs primary-foreground
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Agent and Slash Command Links Below Input */}
      <View className="mt-3 flex-row gap-4 items-start">
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            onShowAgents?.();
          }}
          disabled={disabled || isSending}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${selectedAgents.length > 0 ? 'text-blue-600 font-medium' : 'text-blue-500'} ${disabled || isSending ? 'opacity-50' : ''}`}>
            {selectedAgents.length > 0 ? `agents (${selectedAgents.length})` : 'agent'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={
            selectedCommand
              ? () => setSelectedCommand(null)
              : () => {
                  Keyboard.dismiss();
                  onShowSlashCommands?.();
                }
          }
          disabled={disabled || isSending}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${selectedCommand ? 'text-blue-600 font-medium' : 'text-blue-500'} ${disabled || isSending ? 'opacity-50' : ''}`}>
            {selectedCommand ? `/${selectedCommand}` : 'slash command'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Session Stats */}
      {session && (
        <View className="mt-2 flex-row items-center gap-4">
          <Text className="text-xs text-muted-foreground font-mono">
            {session.messageCount} messages
          </Text>
          <Text className="text-xs text-muted-foreground font-mono">•</Text>
          <Text className="text-xs text-muted-foreground font-mono">
            {session.tokenCount.toLocaleString()} tokens
          </Text>
        </View>
      )}
    </View>
  );
});
