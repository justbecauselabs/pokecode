import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { Button } from '../ui/Button';
import { PromptTemplate } from '@/types/claude';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  onCancel?: () => void;
  templates?: PromptTemplate[];
  placeholder?: string;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  onSubmit,
  isLoading,
  onCancel,
  templates,
  placeholder = 'Ask Claude anything...',
}) => {
  const [text, setText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const inputHeight = useSharedValue(56);

  const handleSubmit = () => {
    if (text.trim() && !isLoading) {
      onSubmit(text.trim());
      setText('');
      Keyboard.dismiss();
    }
  };

  const handleContentSizeChange = (event: any) => {
    const newHeight = Math.min(Math.max(56, event.nativeEvent.contentSize.height + 20), 200);
    inputHeight.value = withSpring(newHeight);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: inputHeight.value,
  }));

  const applyTemplate = (template: PromptTemplate) => {
    setText(template.template);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const characterCount = text.length;
  const maxCharacters = 4000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        ]}
      >
        {templates && templates.length > 0 && (
          <TouchableOpacity
            style={[styles.templatesButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowTemplates(!showTemplates)}
          >
            <Text style={[styles.templatesButtonText, { color: theme.colors.primary }]}>
              Templates
            </Text>
          </TouchableOpacity>
        )}

        {showTemplates && templates && (
          <View style={[styles.templatesList, { backgroundColor: theme.colors.surface }]}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateItem}
                onPress={() => applyTemplate(template)}
              >
                <Text style={[styles.templateName, { color: theme.colors.text }]}>
                  {template.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Animated.View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.colors.surface },
            animatedStyle,
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                ...theme.typography.body,
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            maxLength={maxCharacters}
            onContentSizeChange={handleContentSizeChange}
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
            testID="prompt-input"
          />
          
          <View style={styles.actions}>
            {characterCount > 0 && (
              <Text
                style={[
                  styles.characterCount,
                  { color: theme.colors.textTertiary },
                  characterCount > maxCharacters * 0.9 && { color: theme.colors.warning },
                ]}
              >
                {characterCount}/{maxCharacters}
              </Text>
            )}
            
            {isLoading && onCancel ? (
              <Button
                title="Cancel"
                variant="ghost"
                size="small"
                onPress={onCancel}
              />
            ) : (
              <Button
                title="Send"
                variant="primary"
                size="small"
                onPress={handleSubmit}
                disabled={!text.trim() || isLoading}
                loading={isLoading}
                testID="submit-button"
              />
            )}
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    maxHeight: 180,
    paddingTop: 8,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  characterCount: {
    fontSize: 12,
    marginBottom: 4,
  },
  templatesButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  templatesButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  templatesList: {
    borderRadius: 8,
    marginBottom: 8,
    padding: 8,
  },
  templateItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  templateName: {
    fontSize: 14,
  },
});