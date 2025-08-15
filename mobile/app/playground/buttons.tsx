import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, SafeAreaView } from '@/components/common';

/**
 * Button components playground screen
 */
export default function ButtonsPlaygroundScreen() {
  const router = useRouter();
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const handleButtonPress = (buttonId: string) => {
    Alert.alert('Button Pressed', `You pressed: ${buttonId}`);
  };

  const handleLoadingDemo = (buttonId: string) => {
    setLoadingStates((prev) => ({ ...prev, [buttonId]: true }));
    setTimeout(() => {
      setLoadingStates((prev) => ({ ...prev, [buttonId]: false }));
    }, 2000);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Buttons Playground</Text>
            <Text className="text-muted-foreground">Test button variants and interactions</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Back</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Button Variants */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Button Variants
            </Text>
            <View className="space-y-3">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Primary</Text>
                <Button
                  title="Primary Button"
                  variant="primary"
                  onPress={() => handleButtonPress('Primary')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Secondary</Text>
                <Button
                  title="Secondary Button"
                  variant="secondary"
                  onPress={() => handleButtonPress('Secondary')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Ghost</Text>
                <Button
                  title="Ghost Button"
                  variant="ghost"
                  onPress={() => handleButtonPress('Ghost')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Destructive</Text>
                <Button
                  title="Destructive Button"
                  variant="destructive"
                  onPress={() => handleButtonPress('Destructive')}
                />
              </View>
            </View>
          </View>

          {/* Button Sizes */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Button Sizes
            </Text>
            <View className="space-y-3">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Small</Text>
                <Button
                  title="Small Button"
                  size="small"
                  onPress={() => handleButtonPress('Small')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">
                  Medium (Default)
                </Text>
                <Button
                  title="Medium Button"
                  size="medium"
                  onPress={() => handleButtonPress('Medium')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Large</Text>
                <Button
                  title="Large Button"
                  size="large"
                  onPress={() => handleButtonPress('Large')}
                />
              </View>
            </View>
          </View>

          {/* Button States */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Button States
            </Text>
            <View className="space-y-3">
              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Normal</Text>
                <Button title="Normal State" onPress={() => handleButtonPress('Normal')} />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Loading</Text>
                <Button
                  title="Loading State"
                  loading={loadingStates.loading}
                  onPress={() => handleLoadingDemo('loading')}
                />
              </View>

              <View>
                <Text className="text-sm text-muted-foreground font-mono mb-2">Disabled</Text>
                <Button
                  title="Disabled State"
                  disabled
                  onPress={() => handleButtonPress('Disabled')}
                />
              </View>
            </View>
          </View>

          {/* Full Width Buttons */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Full Width Buttons
            </Text>
            <View className="space-y-3">
              <Button
                title="Full Width Primary"
                variant="primary"
                fullWidth
                onPress={() => handleButtonPress('Full Width Primary')}
              />
              <Button
                title="Full Width Secondary"
                variant="secondary"
                fullWidth
                onPress={() => handleButtonPress('Full Width Secondary')}
              />
              <Button
                title="Full Width Loading"
                loading={loadingStates.fullWidth}
                fullWidth
                onPress={() => handleLoadingDemo('fullWidth')}
              />
            </View>
          </View>

          {/* Buttons with Icons (simulated) */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Buttons with Icons
            </Text>
            <Text className="text-sm text-muted-foreground font-mono mb-3">
              The Button component supports icons via the icon prop
            </Text>
            <View className="space-y-3">
              <Button
                title="Button with Icon"
                icon={<Text className="text-primary-foreground">📎</Text>}
                onPress={() => handleButtonPress('Icon Button')}
              />
              <Button
                title="Secondary with Icon"
                variant="secondary"
                icon={<Text className="text-primary">⚙️</Text>}
                onPress={() => handleButtonPress('Secondary Icon')}
              />
            </View>
          </View>

          {/* Interactive Demo */}
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              Interactive Demo
            </Text>
            <Text className="text-sm text-muted-foreground font-mono mb-4">
              Try tapping these buttons to see alerts and loading states
            </Text>
            <View className="space-y-3">
              <Button
                title="Show Alert"
                variant="primary"
                onPress={() => Alert.alert('Hello!', 'This is an interactive demo')}
              />
              <Button
                title="2-Second Loading Demo"
                variant="secondary"
                loading={loadingStates.demo}
                onPress={() => handleLoadingDemo('demo')}
              />
              <Button
                title="Destructive Action"
                variant="destructive"
                onPress={() =>
                  Alert.alert('Destructive Action', 'This would perform a destructive action', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', style: 'destructive' },
                  ])
                }
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
