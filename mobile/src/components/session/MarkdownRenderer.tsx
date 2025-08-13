import React from 'react';
import Markdown from 'react-native-markdown-display';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const markdownStyles = {
    body: {
      fontSize: 16,
      lineHeight: 24,
    },
    paragraph: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 12,
    },
    code_inline: {
      backgroundColor: '#f5f5f5',
      fontFamily: 'monospace',
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: '#f5f5f5',
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: '#f5f5f5',
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
      padding: 12,
      marginVertical: 8,
      borderRadius: 4,
    },
  };

  return (
    <Markdown style={markdownStyles}>
      {content}
    </Markdown>
  );
};