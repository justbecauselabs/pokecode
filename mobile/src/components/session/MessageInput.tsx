import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface MessageInputRef {
  insertCommand: (params: { commandName: string }) => void;
}

interface MessageInputProps {
  sessionId: string;
  onSendMessage: (params: { content: string }) => Promise<unknown>;
  onShowSlashCommands?: () => void;
  isSending?: boolean;
  disabled?: boolean;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>((props, ref) => {
  const { onSendMessage, onShowSlashCommands, isSending = false, disabled } = props;
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);

  const insertCommand = (params: { commandName: string }) => {
    const commandText = `/${params.commandName}`;
    const newMessage = commandText + (message ? ` ${message}` : '');
    setMessage(newMessage);
    
    // Focus the input after inserting the command
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
      await onSendMessage({ content: trimmedMessage });
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  return (
    <View className="border-t border-border bg-background p-4">
      <Card padding="small" className="bg-input">
        <View className="flex-row items-end gap-3">
          <View className="flex-1">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder="Enter your message..."
              placeholderTextColor="#9da5b4"
              multiline
              textAlignVertical="top"
              className="max-h-32 min-h-10 text-base text-foreground font-mono"
              style={{
                fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
                color: '#abb2bf',
              }}
              editable={!disabled && !isSending}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
          </View>

          {/* Slash Commands Button */}
          <TouchableOpacity
            className="w-8 h-8 rounded-md bg-yellow-500 items-center justify-center mr-2 active:opacity-70"
            onPress={onShowSlashCommands}
            disabled={disabled || isSending}
            activeOpacity={0.7}
          >
            <Text className="text-black text-base font-bold font-mono">/</Text>
          </TouchableOpacity>

          <Button
            title="Send"
            size="small"
            disabled={disabled || !message.trim() || isSending}
            loading={isSending}
            onPress={handleSend}
          />
        </View>
      </Card>
    </View>
  );
});
