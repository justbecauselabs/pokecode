import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

// Citation type is now extracted from the actual message content
type Citation = {
  type: string;
  cited_text: string;
};

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[];
}

// TailwindCSS color tokens extracted to style objects for react-native-markdown-display
// This ensures we use the same colors as our TailwindCSS config but in the required format
const colors = {
  foreground: '#abb2bf', // text-foreground
  card: '#21252b', // bg-card
  destructive: '#e06c75', // text-destructive
  primary: '#528bff', // text-primary
} as const;

const fontFamily = 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace';

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, citations }) => {
  // Using TailwindCSS design tokens in style format (required by react-native-markdown-display)
  const markdownStyles = {
    body: {
      fontSize: 14, // text-code
      lineHeight: 20, // text-code
      color: colors.foreground,
      fontFamily,
      margin: 0,
      padding: 0,
    },
    paragraph: {
      fontSize: 14, // text-code
      lineHeight: 20, // text-code
      marginBottom: 0,
      marginTop: 0,
      color: colors.foreground,
      fontFamily,
    },
    text: {
      color: colors.foreground,
      fontFamily,
    },
    strong: {
      color: colors.foreground,
      fontWeight: 'bold' as const,
      fontFamily,
    },
    em: {
      color: colors.foreground,
      fontStyle: 'italic' as const,
      fontFamily,
    },
    code_inline: {
      backgroundColor: colors.card, // bg-card
      color: colors.destructive, // text-destructive (for inline code)
      fontFamily,
      fontSize: 14, // text-code
      paddingHorizontal: 4, // px-1
      paddingVertical: 2,
      borderRadius: 4, // rounded
    },
    code_block: {
      backgroundColor: colors.card, // bg-card
      color: colors.foreground, // text-foreground
      fontFamily,
      fontSize: 14, // text-code
      lineHeight: 20, // text-code
      padding: 12, // p-3
      marginVertical: 4,
      borderRadius: 4, // rounded
    },
    fence: {
      backgroundColor: colors.card, // bg-card
      color: colors.foreground, // text-foreground
      fontFamily,
      fontSize: 14, // text-code
      lineHeight: 20, // text-code
      padding: 12, // p-3
      marginVertical: 4,
      borderRadius: 4, // rounded
    },
    list_item: {
      color: colors.foreground,
      fontFamily,
    },
    bullet_list: {
      color: colors.foreground,
    },
    ordered_list: {
      color: colors.foreground,
    },
    heading1: {
      color: colors.primary, // text-primary
      fontFamily,
      fontWeight: 'bold' as const,
      fontSize: 20, // text-xl
      marginTop: 0,
      marginBottom: 4,
    },
    heading2: {
      color: colors.primary, // text-primary
      fontFamily,
      fontWeight: 'bold' as const,
      fontSize: 18, // text-lg
      marginTop: 0,
      marginBottom: 4,
    },
    heading3: {
      color: colors.primary, // text-primary
      fontFamily,
      fontWeight: 'bold' as const,
      fontSize: 16, // text-base
      marginTop: 0,
      marginBottom: 4,
    },
  };

  // Render citations using pure TailwindCSS classes
  const renderCitations = () => {
    if (!citations?.length) {
      return null;
    }

    return (
      <View className="mt-3 space-y-2">
        <Text className="text-code-sm font-mono font-semibold text-primary">📎 Citations</Text>
        {citations.map((citation) => (
          <TouchableOpacity
            key={citation.cited_text}
            className="bg-card p-2 rounded border-l-2 border-l-primary"
            onPress={() => {
              // Could implement navigation to source here
            }}
          >
            <Text className="text-code-sm font-mono text-foreground mb-1">
              "{citation.cited_text}"
            </Text>
            <View className="flex-row items-center space-x-2">
              <Text className="text-code-sm font-mono text-muted-foreground">
                {citation.type.replace(/_/g, ' ')}
              </Text>
              {citation.url && (
                <Text className="text-code-sm font-mono text-muted-foreground">
                  • {citation.url}
                </Text>
              )}
              {citation.document_title && (
                <Text className="text-code-sm font-mono text-muted-foreground">
                  • {citation.document_title}
                </Text>
              )}
              {citation.title && (
                <Text className="text-code-sm font-mono text-muted-foreground">
                  • {citation.title}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View>
      <Markdown style={markdownStyles}>{content}</Markdown>
      {renderCitations()}
    </View>
  );
};
