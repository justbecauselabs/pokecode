import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { ToolUse } from '@/types/claude';
import { Card } from '../ui/Card';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface ToolExecutionViewProps {
  tool: ToolUse;
  onPress?: () => void;
}

export const ToolExecutionView: React.FC<ToolExecutionViewProps> = ({
  tool,
  onPress,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const rotation = useSharedValue(0);

  const handleToggle = () => {
    setExpanded(!expanded);
    rotation.value = withSpring(expanded ? 0 : 90);
    onPress?.();
  };

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const getStatusColor = () => {
    switch (tool.status) {
      case 'pending':
        return theme.colors.textSecondary;
      case 'running':
        return theme.colors.info;
      case 'completed':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
    }
  };

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'pending':
        return '○';
      case 'running':
        return '◐';
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
    }
  };

  return (
    <Card variant="outlined" style={styles.container}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.statusIcon,
                { color: getStatusColor() },
              ]}
            >
              {getStatusIcon()}
            </Text>
            <Text
              style={[
                styles.toolName,
                { color: theme.colors.text },
                theme.typography.bodySmall,
              ]}
            >
              {tool.name}
            </Text>
          </View>
          <Animated.Text
            style={[
              styles.chevron,
              { color: theme.colors.textSecondary },
              animatedChevronStyle,
            ]}
          >
            ›
          </Animated.Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {tool.input && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                  theme.typography.caption,
                ]}
              >
                Input:
              </Text>
              <View
                style={[
                  styles.codeBlock,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.code,
                    { color: theme.colors.text },
                    theme.typography.code,
                  ]}
                  selectable
                >
                  {JSON.stringify(tool.input, null, 2)}
                </Text>
              </View>
            </View>
          )}

          {tool.output && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textSecondary },
                  theme.typography.caption,
                ]}
              >
                Output:
              </Text>
              <View
                style={[
                  styles.codeBlock,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.code,
                    { color: theme.colors.text },
                    theme.typography.code,
                  ]}
                  selectable
                >
                  {typeof tool.output === 'string'
                    ? tool.output
                    : JSON.stringify(tool.output, null, 2)}
                </Text>
              </View>
            </View>
          )}

          {tool.error && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.error },
                  theme.typography.caption,
                ]}
              >
                Error:
              </Text>
              <Text
                style={[
                  styles.error,
                  { color: theme.colors.error },
                  theme.typography.bodySmall,
                ]}
              >
                {tool.error}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '600',
  },
  toolName: {
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  details: {
    marginTop: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  codeBlock: {
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  code: {
    fontFamily: 'monospace',
  },
  error: {
    marginTop: 4,
  },
});