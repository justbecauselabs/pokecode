import React, { useState, useRef } from 'react';
import { View, TextInput, Keyboard, Alert } from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function MessageInput(params: { sessionId: string; onSendMessage: (params: { content: string }) => Promise<unknown>; isSending?: boolean; disabled?: boolean }) {
  const { onSendMessage, isSending = false, disabled } = params;
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);

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
    <View className="border-t border-gray-200 bg-white p-4">
      <Card padding="small">
        <View className="flex-row items-end gap-3">
          <View className="flex-1">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder="Enter your message..."
              multiline
              textAlignVertical="top"
              className="max-h-32 min-h-10 text-base"
              editable={!disabled && !isSending}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
          </View>
          
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
}