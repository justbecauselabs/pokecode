/**
 * SessionCard component for displaying individual session information
 */

import { memo } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native';
import type { GetApiClaudeCodeSessionsResponse } from '@/api/generated';
import { formatRelativeTime } from '@/utils/format';

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
        return 'bg-success';
      case 'idle':
        return 'bg-warning';
      case 'expired':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'idle':
        return 'Idle';
      case 'expired':
        return 'Expired';
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
      Alert.alert('Session Actions', session.projectPath, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Session',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]);
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
          onPress: () => onDelete(session.id),
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={() => onPress(session.id)}
      onLongPress={handleLongPress}
      className="bg-card rounded-lg p-4 mb-3 border border-border active:opacity-80"
    >
      <View className="space-y-2">
        {/* Header with project path and status */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-base font-semibold text-card-foreground font-mono" numberOfLines={1}>
              {truncatePath(session.projectPath)}
            </Text>
            {session.context && (
              <Text className="text-sm text-muted-foreground mt-1 font-mono" numberOfLines={2}>
                {session.context}
              </Text>
            )}
          </View>

          <View className={`px-2 py-1 rounded-full ${getStatusColor(session.status)}`}>
            <Text className="text-xs font-medium text-foreground font-mono">
              {getStatusLabel(session.status)}
            </Text>
          </View>
        </View>

        {/* Footer with timestamp */}
        <View>
          <Text className="text-xs text-muted-foreground font-mono">
            {formatRelativeTime(session.lastAccessedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
