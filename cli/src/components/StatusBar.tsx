/**
 * Status bar component showing session info and connection status
 */

import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  sessionPath: string;
  sessionContext?: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  userName?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  sessionPath,
  sessionContext,
  connectionStatus,
  userName
}) => {
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '●';
      case 'connecting':
        return '◐';
      case 'disconnected':
        return '○';
      case 'error':
        return '✗';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'green';
      case 'connecting':
        return 'yellow';
      case 'disconnected':
        return 'gray';
      case 'error':
        return 'red';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
    }
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text bold color="cyan">PokeCode CLI</Text>
        <Text dimColor> | </Text>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {getStatusText()}
        </Text>
        {userName && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>{userName}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text dimColor>📁 </Text>
        <Text color="white">{truncatePath(sessionPath, 40)}</Text>
        {sessionContext && (
          <>
            <Text dimColor> | </Text>
            <Text dimColor>{truncateText(sessionContext, 30)}</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;
  
  const parts = path.split('/');
  if (parts.length <= 2) {
    return '...' + path.slice(-maxLength + 3);
  }
  
  // Show first and last parts
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}