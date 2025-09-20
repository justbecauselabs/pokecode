import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { KeyboardEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSettingsStore } from '@/stores/settingsStore';

type Props = {
  visible: boolean;
  onOpenSettings?: () => void;
};

export function ConnectivityModal(props: Props) {
  const custom = useSettingsStore((s) => s.customApiBaseUrl);
  const setCustom = useSettingsStore((s) => s.setCustomApiBaseUrl);
  const effectiveUrl = useMemo<string>(() => custom?.trim() ?? '', [custom]);
  const [url, setUrl] = useState<string>(effectiveUrl);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const keyboardOffset = useSharedValue(0);
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardOffset.value,
  }));

  useEffect(() => {
    setUrl(effectiveUrl);
  }, [effectiveUrl]);

  useEffect(() => {
    const showEvent = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideEvent = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';

    const platformAdjustment = Platform.OS === 'ios' ? 0 : 16;

    const handleKeyboardShow = (event: KeyboardEvent): void => {
      const target = Math.max(event.endCoordinates.height - platformAdjustment, 0);
      keyboardOffset.value = withTiming(target, {
        duration: 220,
        easing: Easing.out(Easing.ease),
      });
    };

    const handleKeyboardHide = (): void => {
      keyboardOffset.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.ease),
      });
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (!props.visible) {
      setIsEditing(false);
      setError(undefined);
    }
  }, [props.visible]);

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
    setUrl(trimmed);
    setCustom(trimmed);
    setIsEditing(false);
  }

  const isInitialSetup = effectiveUrl.length === 0;
  const shouldShowEdit = isInitialSetup || isEditing;

  if (shouldShowEdit) {
    const isSaveDisabled = url.trim().length === 0;

    return (
      <Modal
        visible={props.visible}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <Animated.View className="flex-1 bg-background" style={containerAnimatedStyle}>
          <View className="flex-1 px-6 pt-20 pb-6">
            <View>
              <Text className="text-foreground text-2xl font-semibold text-center mb-3">
                Connect to your PokéCode server
              </Text>
              <Text className="text-muted-foreground text-base text-center">
                Enter the URL for the local server running on your computer.
              </Text>
            </View>

            <View className="flex-1 justify-center">
              <Text className="text-sm text-muted-foreground mb-2">Server URL</Text>
              <TextInput
                value={url}
                onChangeText={(value) => {
                  setError(undefined);
                  setUrl(value);
                }}
                placeholder="http://<your-computer-ip>:3001"
                placeholderTextColor="#9da5b4"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="px-3 py-3 rounded-md bg-input text-foreground border border-border"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              {error ? <Text className="text-destructive mt-2">{error}</Text> : null}
            </View>

            <View className="gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={handleSave}
                disabled={isSaveDisabled}
                className={`w-full items-center justify-center rounded-md py-3 ${
                  isSaveDisabled ? 'bg-muted' : 'bg-primary'
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    isSaveDisabled ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}
                >
                  Save
                </Text>
              </Pressable>
              {isInitialSetup ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError(undefined);
                    setIsEditing(false);
                    setUrl(effectiveUrl);
                  }}
                  className="w-full items-center justify-center rounded-md py-3 border border-border"
                >
                  <Text className="text-base font-semibold text-foreground">Cancel</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      <Animated.View className="flex-1 bg-background" style={containerAnimatedStyle}>
        <View className="flex-1 px-6 pt-14 pb-6 justify-between">
          <View className="flex-1 items-center justify-center px-2">
            <View className="items-center mb-8">
              <Ionicons name="cloud-offline-outline" size={64} color="#abb2bf" />
            </View>
            <Text className="text-foreground text-2xl font-semibold mb-3 text-center">
              Can’t Reach Your Local Server
            </Text>
            <Text className="text-muted-foreground text-base text-center max-w-md">
              Please run the PokéCode server on your computer and make sure your phone and computer
              are on the same network.
            </Text>
          </View>

          <View className="gap-4">
            <View className="bg-card border border-border rounded-md p-4 items-center gap-3">
              <Text className="text-sm text-muted-foreground">Current server</Text>
              <Text className="text-foreground text-center" selectable>
                {effectiveUrl}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsEditing(true);
                setError(undefined);
                setUrl(effectiveUrl);
              }}
              className="w-full items-center justify-center rounded-md bg-primary py-3"
            >
              <Text className="text-primary-foreground text-base font-semibold">
                Edit Server URL
              </Text>
            </Pressable>
            {props.onOpenSettings ? (
              <Pressable
                accessibilityRole="button"
                onPress={props.onOpenSettings}
                className="w-full items-center justify-center rounded-md border border-border py-3"
              >
                <Text className="text-foreground text-base font-semibold">
                  Open Advanced Settings
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
