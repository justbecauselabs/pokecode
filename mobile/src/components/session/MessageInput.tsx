import { Feather } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Keyboard, type TextInput, TouchableOpacity, View } from 'react-native';
import { Pill, TextField } from '../common';

export interface MessageInputRef {
  insertCommand: (params: { commandName: string }) => void;
  insertAgent: (params: { agentName: string }) => void;
}

interface MessageInputProps {
  sessionId: string;
  onSendMessage: (params: { content: string; agent?: string }) => Promise<unknown>;
  onShowSlashCommands?: () => void;
  onShowAgents?: () => void;
  isSending?: boolean;
  disabled?: boolean;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>((props, ref) => {
  const { onSendMessage, onShowSlashCommands, onShowAgents, isSending = false, disabled } = props;
  const [message, setMessage] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const insertCommand = (params: { commandName: string }) => {
    setSelectedCommand(params.commandName);

    // Focus the input after selecting the command
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const insertAgent = (params: { agentName: string }) => {
    setSelectedAgent(params.agentName);

    // Focus the input after selecting the agent
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    insertCommand,
    insertAgent,
  }));

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || disabled) return;

    Keyboard.dismiss();

    try {
      // Prepend the selected command if one is active
      const finalMessage = selectedCommand
        ? `/${selectedCommand} ${trimmedMessage}`
        : trimmedMessage;
      
      await onSendMessage({ 
        content: finalMessage, 
        agent: selectedAgent || undefined 
      });
      
      setMessage('');
      setSelectedCommand(null); // Clear the selected command after sending
      setSelectedAgent(null); // Clear the selected agent after sending
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
            className="max-h-32"
            editable={!disabled && !isSending}
            onSubmitEditing={handleSend}
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
              color={disabled || !message.trim() || isSending ? '#9ca3af' : '#282c34'}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Agent and Slash Command Buttons Below Input */}
      <View className="mt-3 flex-row gap-2 items-start">
        <Pill
          variant={selectedAgent ? 'active' : 'default'}
          onPress={selectedAgent ? () => setSelectedAgent(null) : () => {
            Keyboard.dismiss();
            onShowAgents?.();
          }}
          disabled={disabled || isSending}
        >
          {selectedAgent ? selectedAgent : 'agent'}
        </Pill>
        
        <Pill
          variant={selectedCommand ? 'active' : 'default'}
          onPress={selectedCommand ? () => setSelectedCommand(null) : () => {
            Keyboard.dismiss();
            onShowSlashCommands?.();
          }}
          disabled={disabled || isSending}
        >
          {selectedCommand ? `/${selectedCommand}` : 'slash command'}
        </Pill>
      </View>
    </View>
  );
});
