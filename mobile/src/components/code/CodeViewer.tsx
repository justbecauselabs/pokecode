import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { github } from 'react-syntax-highlighter/styles/hljs';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { Button } from '../ui/Button';
import Clipboard from '@react-native-clipboard/clipboard';

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  onEdit?: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'text',
  filename,
  showLineNumbers,
  wrapLines,
  onEdit,
}) => {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  const uiStore = useUIStore();
  
  const syntaxTheme = github;
  const shouldShowLineNumbers = showLineNumbers ?? uiStore.showLineNumbers;
  const shouldWrapLines = wrapLines ?? uiStore.wordWrap;

  const handleCopy = () => {
    Clipboard.setString(code);
    Alert.alert('Copied', 'Code copied to clipboard', [{ text: 'OK' }]);
  };

  const customStyle = useMemo(() => ({
    fontSize: uiStore.fontSize,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  }), [uiStore.fontSize, theme]);

  return (
    <View style={styles.container}>
      {(filename || onEdit) && (
        <View
          style={[
            styles.header,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          {filename && (
            <Text
              style={[
                styles.filename,
                { color: theme.colors.text },
                theme.typography.bodySmall,
              ]}
            >
              {filename}
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleCopy} style={styles.actionButton}>
              <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                Copy
              </Text>
            </TouchableOpacity>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      <ScrollView
        horizontal={!shouldWrapLines}
        showsHorizontalScrollIndicator={!shouldWrapLines}
        showsVerticalScrollIndicator={true}
      >
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={customStyle}
        >
          {code}
        </SyntaxHighlighter>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filename: {
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 16,
    padding: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});