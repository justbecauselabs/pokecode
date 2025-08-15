import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
// Citation type is now extracted from the actual message content
type Citation = {
  type: string;
  cited_text: string;
  [key: string]: any;
};

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[];
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, citations }) => {
  const markdownStyles = {
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    paragraph: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 12,
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    text: {
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    strong: {
      color: '#abb2bf', // One Dark Pro foreground
      fontWeight: 'bold' as const,
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    em: {
      color: '#abb2bf', // One Dark Pro foreground
      fontStyle: 'italic' as const,
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    code_inline: {
      backgroundColor: '#21252b', // One Dark Pro card background
      color: '#e06c75', // One Dark Pro red for inline code
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: '#21252b', // One Dark Pro card background
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontSize: 14,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: '#21252b', // One Dark Pro card background
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontSize: 14,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: 4,
    },
    list_item: {
      color: '#abb2bf', // One Dark Pro foreground
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
    },
    bullet_list: {
      color: '#abb2bf', // One Dark Pro foreground
    },
    ordered_list: {
      color: '#abb2bf', // One Dark Pro foreground
    },
    heading1: {
      color: '#528bff', // One Dark Pro blue
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontWeight: 'bold' as const,
      fontSize: 24,
    },
    heading2: {
      color: '#528bff', // One Dark Pro blue
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontWeight: 'bold' as const,
      fontSize: 20,
    },
    heading3: {
      color: '#528bff', // One Dark Pro blue
      fontFamily: 'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
      fontWeight: 'bold' as const,
      fontSize: 18,
    },
  };

  // Render citations
  const renderCitations = () => {
    if (!citations?.length) return null;

    return (
      <View className="mt-3 space-y-2">
        <Text className="text-sm font-mono font-medium text-blue-700 dark:text-blue-300">
          📎 Citations
        </Text>
        {citations.map((citation, index) => (
          <TouchableOpacity
            key={index}
            className="bg-blue-50 dark:bg-blue-950 p-2 rounded border-l-2 border-blue-300 dark:border-blue-700"
            onPress={() => {
              // Could implement navigation to source here
            }}
          >
            <Text className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
              "{citation.cited_text}"
            </Text>
            <View className="flex-row items-center space-x-2">
              <Text className="text-xs font-mono text-blue-500 dark:text-blue-500">
                {citation.type.replace(/_/g, ' ')}
              </Text>
              {citation.url && (
                <Text className="text-xs font-mono text-blue-500 dark:text-blue-500">
                  • {citation.url}
                </Text>
              )}
              {citation.document_title && (
                <Text className="text-xs font-mono text-blue-500 dark:text-blue-500">
                  • {citation.document_title}
                </Text>
              )}
              {citation.title && (
                <Text className="text-xs font-mono text-blue-500 dark:text-blue-500">
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
