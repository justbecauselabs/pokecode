import type React from 'react';
import { Text, View } from 'react-native';

/**
 * Debug component to verify theme colors are applied correctly
 */
export const ThemeDebug: React.FC = () => {
  return (
    <View className="p-4 bg-background">
      <Text className="text-foreground text-lg font-bold mb-4">Theme Debug</Text>

      <View className="space-y-2">
        <View className="bg-card p-3 rounded">
          <Text className="text-card-foreground">Card Background</Text>
        </View>

        <View className="bg-primary p-3 rounded">
          <Text className="text-primary-foreground">Primary Button</Text>
        </View>

        <View className="bg-secondary p-3 rounded">
          <Text className="text-secondary-foreground">Secondary Element</Text>
        </View>

        <View className="bg-muted p-3 rounded">
          <Text className="text-muted-foreground">Muted Text</Text>
        </View>

        <View className="bg-destructive p-3 rounded">
          <Text className="text-destructive-foreground">Error State</Text>
        </View>

        <View className="border border-border p-3 rounded">
          <Text className="text-foreground">Border Example</Text>
        </View>
      </View>
    </View>
  );
};
