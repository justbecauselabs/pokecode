import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/constants/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  visible: boolean;
  onOpenSettings?: () => void;
};

export function ConnectivityModal(props: Props) {
  const custom = useSettingsStore((s) => s.customApiBaseUrl);
  const setCustom = useSettingsStore((s) => s.setCustomApiBaseUrl);
  const effectiveUrl = useMemo<string>(() => custom || API_BASE_URL, [custom]);
  const [url, setUrl] = useState<string>(effectiveUrl);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setUrl(effectiveUrl);
  }, [effectiveUrl]);

  function isValidHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
  }

  function handleSave(): void {
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      setError('Enter a valid http(s) URL');
      return;
    }
    setError(undefined);
    setCustom(trimmed);
  }

  function handleReset(): void {
    setError(undefined);
    setCustom(undefined);
  }

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-background px-6 py-10">
        <View className="flex-1 items-center justify-center">
          <View className="items-center mb-8">
            <Ionicons name="cloud-offline-outline" size={64} color="#abb2bf" />
          </View>
          <Text className="text-foreground text-2xl font-semibold mb-3 text-center">
            Can’t Reach Your Local Server
          </Text>
          <Text className="text-muted-foreground text-base text-center max-w-md">
            Please run the PokéCode server on your computer and make sure your phone and computer are on the same network.
          </Text>
        </View>

        <View className="gap-4">
          <View className="bg-card border border-border rounded-md p-4">
            <Text className="text-sm text-muted-foreground mb-2">Current host</Text>
            <Text className="text-foreground mb-3" selectable>{effectiveUrl}</Text>
            <Text className="text-sm text-muted-foreground mb-2">Update host URL</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="http://<your-computer-ip>:3001"
              placeholderTextColor="#9da5b4"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="px-3 py-2 rounded-md bg-input text-foreground border border-border"
            />
            {error ? <Text className="text-destructive mt-1">{error}</Text> : null}
            <View className="flex-row gap-3 mt-3">
              <Pressable
                accessibilityRole="button"
                onPress={handleSave}
                className="flex-1 items-center justify-center rounded-md bg-primary py-2"
              >
                <Text className="text-primary-foreground font-semibold">Save</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleReset}
                className="flex-1 items-center justify-center rounded-md bg-card py-2 border border-border"
              >
                <Text className="text-foreground">Use Default</Text>
              </Pressable>
            </View>
          </View>
          {props.onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              onPress={props.onOpenSettings}
              className="w-full items-center justify-center rounded-md bg-primary py-3"
            >
              <Text className="text-primary-foreground text-base font-semibold">Open Advanced Settings</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
