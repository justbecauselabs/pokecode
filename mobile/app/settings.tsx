import { ClaudeModel, getModelDisplayName } from '@pokecode/api';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Row, SafeAreaView } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Settings screen for configuring app preferences
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { customApiBaseUrl, defaultModel, resetSettings } = useSettingsStore();

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            Alert.alert('Settings Reset', 'All settings have been reset to default values.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Settings Content */}
        <ScrollView className="flex-1 p-4">
          {/* API Configuration Section */}
          <View className="bg-card rounded-lg border border-border mb-4">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                API Configuration
              </Text>
              <Text className="text-xs text-muted-foreground mt-1 font-mono">
                Configure backend API settings
              </Text>
            </View>

            <Row
              title="Backend URL"
              subtitle={customApiBaseUrl || 'Default (built-in)'}
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'cloud',
                size: 24,
                color: '#666666',
              }}
              trailing={{
                type: 'text',
                content: getModelDisplayName(defaultModel || ClaudeModel.SONNET),
                className: 'text-xs font-mono',
              }}
              showCaret
              onPress={() => router.push('/settings/backend-url')}
              className="border-b border-border"
            />

            <Row
              title="Reset All Settings"
              subtitle="Reset all settings to default values"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'restore',
                size: 24,
                color: '#ef4444',
              }}
              onPress={handleReset}
              titleClassName="text-destructive"
              subtitleClassName="text-destructive/70"
            />
          </View>

          {/* UI Playground Section */}
          <View className="bg-card rounded-lg border border-border">
            <View className="p-4 border-b border-border">
              <Text className="text-lg font-semibold text-card-foreground font-mono">
                UI Playground
              </Text>
              <Text className="text-xs text-muted-foreground mt-1 font-mono">
                Explore and test UI components used throughout the app
              </Text>
            </View>

            <Row
              title="Typography & Fonts"
              subtitle="Explore different font sizes, weights, and styles"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'text-format',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/fonts')}
              className="border-b border-border"
            />

            <Row
              title="Buttons"
              subtitle="Test different button variants, sizes, and states"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'radio-button-unchecked',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/buttons')}
              className="border-b border-border"
            />

            <Row
              title="Pills"
              subtitle="Interactive pill components with different variants"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'label',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/pills')}
              className="border-b border-border"
            />

            <Row
              title="Rows"
              subtitle="Flexible row components with leading/trailing elements"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'view-list',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/rows')}
              className="border-b border-border"
            />

            <Row
              title="Colors"
              subtitle="Theme color palette and usage examples"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'palette',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/colors')}
              className="border-b border-border"
            />

            <Row
              title="Message View"
              subtitle="API message components for user and assistant conversations"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'message',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/message-view')}
              className="border-b border-border"
            />

            <Row
              title="TextField"
              subtitle="Interactive text input with multiline, autogrow, and size options"
              leading={{
                type: 'icon',
                library: 'MaterialIcons',
                name: 'text-fields',
                size: 24,
                color: '#666666',
              }}
              showCaret
              onPress={() => router.push('/playground/textfield')}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
