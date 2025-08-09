/**
 * Code block component with basic syntax highlighting
 */

import React from 'react';
import { Box, Text } from 'ink';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const lines = code.split('\n');
  const maxLineNumWidth = String(lines.length).length;

  return (
    <Box 
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginY={1}
    >
      {language && (
        <Box marginBottom={1}>
          <Text dimColor>{language}</Text>
        </Box>
      )}
      {lines.map((line, index) => (
        <Box key={index}>
          <Text dimColor>
            {String(index + 1).padStart(maxLineNumWidth, ' ')} │ 
          </Text>
          <Text color="green">{line}</Text>
        </Box>
      ))}
    </Box>
  );
};