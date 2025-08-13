/**
 * SessionCard component for displaying individual session information
 */

import { memo } from 'react';
import { View, Text, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { formatRelativeTime } from '@/utils/format';
import type { GetApiClaudeCodeSessionsResponse } from '@/api/generated';

type Session = GetApiClaudeCodeSessionsResponse['sessions'][0];

interface SessionCardProps {
  session: Session;
  onPress: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

/**
 * Displays a session card with project path, context, status, and last accessed time
 */
export const SessionCard = memo(({ session, onPress, onDelete }: SessionCardProps) => {
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-500';
      case 'archived':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'archived':
        return 'Archived';
      default:
        return 'Unknown';
    }
  };

  const truncatePath = (path: string, maxLength: number = 40) => {
    if (path.length <= maxLength) return path;
    return '...' + path.slice(-(maxLength - 3));
  };

  const handleLongPress = () => {
    if (!onDelete) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Session'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Session Actions',
          message: session.projectPath,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDelete();
          }
        }
      );
    } else {
      // For Android, show Alert dialog
      Alert.alert(
        'Session Actions',
        session.projectPath,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete Session', 
            style: 'destructive',
            onPress: handleDelete
          },
        ]
      );
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDelete(session.id)
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={() => onPress(session.id)}
      onLongPress={handleLongPress}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 border border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700"
    >
      <View className="space-y-2">
        {/* Header with project path and status */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text 
              className="text-base font-semibold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {truncatePath(session.projectPath)}
            </Text>
            {session.context && (
              <Text 
                className="text-sm text-gray-600 dark:text-gray-300 mt-1"
                numberOfLines={2}
              >
                {session.context}
              </Text>
            )}
          </View>
          
          <View className={`px-2 py-1 rounded-full ${getStatusColor(session.status)}`}>
            <Text className="text-xs font-medium text-white">
              {getStatusLabel(session.status)}
            </Text>
          </View>
        </View>

        {/* Footer with timestamp */}
        <View>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {formatRelativeTime(session.lastAccessedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});