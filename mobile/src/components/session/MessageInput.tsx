import { Feather } from '@expo/vector-icons';
import { type ClaudeModel } from '@pokecode/api';
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
  onCancelSession?: () => Promise<unknown>;
  onShowSlashCommands?: () => void;
  onShowAgents?: () => void;
  onShowModels?: () => void;
  selectedAgents: string[];
  selectedModel?: ClaudeModel;
  isSending?: boolean;
  isWorking?: boolean;
  isCancelling?: boolean;
  disabled?: boolean;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>((props, ref) => {
  const {
    onSendMessage,
    onCancelSession,
    onShowSlashCommands,
    onShowAgents,
    onShowModels,
    selectedAgents,
    selectedModel,
    isSending = false,
    isWorking = false,
    isCancelling = false,
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
    if (!trimmedMessage || isSending || disabled) {
      return;
    }

    Keyboard.dismiss();

    try {
      let finalMessage = trimmedMessage;

      // Prepend selected agents if any are active
      if (selectedAgents.length > 0) {
        const agentText = selectedAgents.map((agent) => `- @agent-${agent}`).join('\n');
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

  const handleCancel = async () => {
    if (!onCancelSession || isCancelling) {
      return;
    }

    try {
      await onCancelSession();
    } catch (error) {
      console.error('Failed to cancel session:', error);
      Alert.alert('Error', 'Failed to cancel session. Please try again.');
    }
  };

  return (
    <View className="bg-background px-3 py-4">
      {/* Pending status above input */}
      {isWorking && (
        <View className="mb-2 flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-indicator-loading" />
          <Text className="text-muted-foreground">Your agent is working</Text>
          <View className="h-3 w-3 rounded-full border-2 border-indicator-loading border-t-transparent animate-spin" />
        </View>
      )}

      {/* Unified input container */}
      <View className="rounded-2xl border border-border bg-input p-3">
        {/* Full-width text input */}
        <TextField
          ref={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message ..."
          multiline
          autoGrow
          textAlignVertical="top"
          editable={!disabled && !isSending}
          returnKeyType="default"
          blurOnSubmit={false}
          variant="default"
          containerClassName="rounded-2xl border-0 bg-transparent"
          contentPaddingX={10}
        />

        {/* Actions row with send on right */}
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onShowModels?.();
              }}
            disabled={disabled || isSending}
            activeOpacity={0.7}
            className={disabled || isSending ? 'opacity-50' : ''}
          >
            <Feather name="cpu" size={18} color="#9da5b4" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              onShowSlashCommands?.();
            }}
            disabled={disabled || isSending}
            activeOpacity={0.7}
            className={disabled || isSending ? 'opacity-50' : ''}
          >
            <Feather name="hash" size={18} color="#9da5b4" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              onShowAgents?.();
            }}
            disabled={disabled || isSending}
            activeOpacity={0.7}
            className={disabled || isSending ? 'opacity-50' : ''}
          >
            <Feather name="users" size={18} color="#9da5b4" />
          </TouchableOpacity>
          </View>

          {/* Send/Stop Button */}
          {isWorking ? (
            <TouchableOpacity
              className={`h-8 w-8 items-center justify-center rounded active:opacity-70 ${
                disabled || isCancelling ? 'bg-gray-500' : 'bg-red-500'
              }`}
              onPress={handleCancel}
              disabled={disabled || isCancelling}
              activeOpacity={0.7}
            >
              {isCancelling ? (
                <View className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
              ) : (
                <View className="h-3 w-3 rounded-sm bg-white" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`h-8 w-8 items-center justify-center rounded-full active:opacity-70 ${
                disabled || !message.trim() || isSending ? 'bg-gray-500' : 'bg-white'
              }`}
              onPress={handleSend}
              disabled={disabled || !message.trim() || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <View className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
              ) : (
                <Feather
                  name="arrow-up"
                  size={16}
                  color={disabled || !message.trim() || isSending ? '#9ca3af' : '#282c34'}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});
