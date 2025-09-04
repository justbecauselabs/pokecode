import { Feather } from '@expo/vector-icons';
import type React from 'react';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { textStyles } from '../../utils/styleUtils';

interface MessageTaskToolViewProps {
  agentName: string;
  messageCount: number;
  agentColors?: Record<string, string>;
  onPress?: () => void;
}

export const MessageTaskToolView: React.FC<MessageTaskToolViewProps> = memo(
  ({ agentName, messageCount, agentColors, onPress }) => {
    const handlePress = () => {
      console.log('🎯 MessageTaskToolView pressed!', { agentName, messageCount });
      onPress?.();
    };

    // Get the color for this agent, fallback to default blue
    const agentColor = agentColors?.[agentName] || '#3b82f6';

    return (
      <Pressable
        className="p-3 active:opacity-70 flex-row items-center justify-between"
        onPress={handlePress}
      >
        <View className="flex-1">
          <Text className={`${textStyles.messageContent} font-semibold mb-1`}>
            Using <Text style={{ color: agentColor }}>{agentName}</Text>
          </Text>

          <Text className={`${textStyles.messageContentSm} text-muted-foreground`}>
            Messages ({messageCount})
          </Text>
        </View>

        {/* Caret icon to indicate tappable */}
        <Feather name="chevron-right" size={16} color="#9ca3af" className="ml-2" />
      </Pressable>
    );
  },
);
