import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsFormData } from '@/types/settings';

/**
 * Settings screen for configuring app preferences
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { customApiBaseUrl, setCustomApiBaseUrl, resetSettings } = useSettingsStore();

  const [formData, setFormData] = useState<SettingsFormData>({
    customApiBaseUrl: customApiBaseUrl || '',
  });

  const handleSave = () => {
    const trimmedUrl = formData.customApiBaseUrl.trim();

    // Validate URL format if provided
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid URL (e.g., https://api.example.com)');
      return;
    }

    // Save to store
    setCustomApiBaseUrl(trimmedUrl || undefined);

    Alert.alert('Settings Saved', 'Your settings have been updated successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

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
            setFormData({ customApiBaseUrl: '' });
            Alert.alert('Settings Reset', 'All settings have been reset to default values.');
          },
        },
      ]
    );
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const hasChanges = formData.customApiBaseUrl !== (customApiBaseUrl || '');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground mb-1">Settings</Text>
            <Text className="text-muted-foreground">Configure app preferences</Text>
          </View>
          <Pressable onPress={() => router.back()} className="ml-4 p-2 rounded-lg bg-muted">
            <Text className="text-muted-foreground text-sm font-medium font-mono">Cancel</Text>
          </Pressable>
        </View>

        {/* Settings Form */}
        <View className="flex-1 p-4">
          <View className="bg-card rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-card-foreground mb-4 font-mono">
              API Configuration
            </Text>

            {/* Custom API Base URL */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-card-foreground mb-2 font-mono">
                Custom API Base URL
              </Text>
              <Text className="text-xs text-muted-foreground mb-3 font-mono">
                Override the default API endpoint. Leave empty to use default.
              </Text>
              <TextInput
                value={formData.customApiBaseUrl}
                onChangeText={(text) => setFormData({ ...formData, customApiBaseUrl: text })}
                placeholder="https://api.example.com"
                placeholderTextColor="#888"
                className="bg-background border border-border rounded-lg px-3 py-3 text-foreground font-mono"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            {/* Current Status */}
            <View className="mb-6 p-3 bg-muted rounded-lg">
              <Text className="text-sm font-medium text-muted-foreground mb-1 font-mono">
                Current API Endpoint:
              </Text>
              <Text className="text-sm text-foreground font-mono">
                {customApiBaseUrl || 'Default (built-in)'}
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              <Pressable
                onPress={handleSave}
                disabled={!hasChanges}
                className={`py-3 px-4 rounded-lg ${hasChanges ? 'bg-primary' : 'bg-muted'}`}
              >
                <Text
                  className={`text-center font-medium font-mono ${
                    hasChanges ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Save Changes
                </Text>
              </Pressable>

              <Pressable
                onPress={handleReset}
                className="py-3 px-4 rounded-lg border border-destructive"
              >
                <Text className="text-center font-medium text-destructive font-mono">
                  Reset to Defaults
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
