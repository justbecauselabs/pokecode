import { ClaudeModel, getModelDisplayName } from '@pokecode/api';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/common';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsFormData } from '@/types/settings';

/**
 * Backend URL Settings screen for configuring API endpoints
 */
export default function BackendUrlSettingsScreen() {
  const router = useRouter();
  const { customApiBaseUrl, defaultModel, setCustomApiBaseUrl, setDefaultModel } =
    useSettingsStore();

  const [formData, setFormData] = useState<SettingsFormData>({
    customApiBaseUrl: customApiBaseUrl || '',
    defaultModel: defaultModel || ClaudeModel.SONNET,
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
    setDefaultModel(formData.defaultModel);

    Alert.alert('Settings Saved', 'Your backend URL settings have been updated successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleResetApiSettings = () => {
    Alert.alert(
      'Reset API Settings',
      'Are you sure you want to reset API settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setCustomApiBaseUrl(undefined);
            setDefaultModel(ClaudeModel.SONNET);
            setFormData({ customApiBaseUrl: '', defaultModel: ClaudeModel.SONNET });
            Alert.alert('API Settings Reset', 'API settings have been reset to default values.');
          },
        },
      ],
    );
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return typeof parsed.href === 'string' && parsed.href.length > 0;
    } catch {
      return false;
    }
  };

  const hasChanges =
    formData.customApiBaseUrl !== (customApiBaseUrl || '') ||
    formData.defaultModel !== (defaultModel || 'sonnet');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        {/* Settings Content */}
        <ScrollView className="flex-1 p-4">
          {/* API Configuration */}
          <View className="bg-card rounded-lg p-4 border border-border mb-4">
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

            {/* Default Model Selection */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-card-foreground mb-2 font-mono">
                Default Claude Model
              </Text>
              <Text className="text-xs text-muted-foreground mb-3 font-mono">
                Default model for messages. You can override per message.
              </Text>
              <View className="bg-background border border-border rounded-lg px-3 py-3 flex-row items-center justify-between">
                <Text className="text-foreground font-mono flex-1">
                  {getModelDisplayName(formData.defaultModel)}
                </Text>
                <Text className="text-muted-foreground font-mono text-sm">Current</Text>
              </View>
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
                onPress={handleResetApiSettings}
                className="py-3 px-4 rounded-lg border border-destructive"
              >
                <Text className="text-center font-medium text-destructive font-mono">
                  Reset API Settings
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
