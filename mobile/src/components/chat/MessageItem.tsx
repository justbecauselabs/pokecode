import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { ClaudeMessage, ToolUse } from '@/types/claude';
import { Card } from '../ui/Card';
import { ToolExecutionView } from './ToolExecutionView';
import { StreamingIndicator } from './StreamingIndicator';
import Markdown from 'react-native-markdown-display';
import { format } from 'date-fns';
import Clipboard from '@react-native-clipboard/clipboard';

interface MessageItemProps {
  message: ClaudeMessage;
  isStreaming: boolean;
  onToolClick?: (tool: ToolUse) => void;
  onFileClick?: (path: string) => void;
}

export const MessageItem = memo<MessageItemProps>(({
  message,
  isStreaming,
  onToolClick,
  onFileClick,
}) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;

  const markdownStyles = useMemo(() => ({
    body: {
      color: theme.colors.text,
      ...theme.typography.body,
    },
    heading1: {
      ...theme.typography.h1,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    heading2: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    heading3: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    code_inline: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.syntax.keyword,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    code_block: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginVertical: theme.spacing.sm,
    },
    fence: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginVertical: theme.spacing.sm,
    },
    link: {
      color: theme.colors.primary,
      textDecorationLine: 'underline' as const,
    },
    blockquote: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      paddingLeft: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginVertical: theme.spacing.sm,
    },
    list_item: {
      marginVertical: theme.spacing.xs,
    },
    hr: {
      backgroundColor: theme.colors.border,
      height: 1,
      marginVertical: theme.spacing.md,
    },
  }), [theme, isDark]);

  const handleCodeCopy = (code: string) => {
    Clipboard.setString(code);
    Alert.alert('Copied', 'Code copied to clipboard', [{ text: 'OK' }]);
  };

  const formattedTime = useMemo(() => 
    format(new Date(message.createdAt), 'HH:mm'),
    [message.createdAt]
  );

  const messageContent = useMemo(() => {
    if (!message.content && isStreaming) {
      return <StreamingIndicator />;
    }

    return (
      <Markdown
        style={markdownStyles}
        onLinkPress={(url) => {
          if (url.startsWith('file://') && onFileClick) {
            onFileClick(url.replace('file://', ''));
          }
          return true;
        }}
      >
        {message.content || ''}
      </Markdown>
    );
  }, [message.content, isStreaming, markdownStyles, onFileClick]);

  return (
    <View style={[
      styles.container,
      message.role === 'user' && styles.userContainer,
    ]}>
      <Card
        variant={message.role === 'user' ? 'filled' : 'outlined'}
        style={[
          styles.messageCard,
          message.role === 'user' && styles.userCard,
        ]}
      >
        <View style={styles.header}>
          <Text style={[
            styles.role,
            { color: theme.colors.textSecondary },
            theme.typography.caption,
          ]}>
            {message.role === 'user' ? 'You' : 'Claude'}
          </Text>
          <Text style={[
            styles.time,
            { color: theme.colors.textTertiary },
            theme.typography.caption,
          ]}>
            {formattedTime}
          </Text>
        </View>

        <View style={styles.content}>
          {messageContent}
        </View>

        {message.toolUses && message.toolUses.length > 0 && (
          <View style={styles.tools}>
            {message.toolUses.map((tool) => (
              <ToolExecutionView
                key={tool.id}
                tool={tool}
                onPress={() => onToolClick?.(tool)}
              />
            ))}
          </View>
        )}

        {isStreaming && (
          <View style={styles.streamingStatus}>
            <StreamingIndicator />
          </View>
        )}
      </Card>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for streaming messages
  if (nextProps.isStreaming) return false;
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.message.toolUses?.length === nextProps.message.toolUses?.length;
});

MessageItem.displayName = 'MessageItem';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    alignItems: 'flex-start',
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageCard: {
    width: '100%',
  },
  userCard: {
    // Add any user-specific styles
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  role: {
    fontWeight: '600',
  },
  time: {
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  tools: {
    marginTop: 12,
  },
  streamingStatus: {
    marginTop: 8,
  },
});