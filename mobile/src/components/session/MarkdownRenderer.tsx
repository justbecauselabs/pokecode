import type React from 'react';
import Markdown from 'react-native-markdown-display';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
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

  return <Markdown style={markdownStyles}>{content}</Markdown>;
};
