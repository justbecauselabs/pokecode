import { Modal, Pressable, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onOpenSettings?: () => void;
};

export function ConnectivityModal(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-lg w-full max-w-md">
          <Text className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 mb-2">
            Connect to Your Computer
          </Text>
          <Text className="text-neutral-700 dark:text-neutral-300 mb-4">
            We couldn’t reach the local server. Please run it on your computer and ensure your phone
            is on the same network.
          </Text>
          <View className="flex-row justify-end gap-3">
            {props.onOpenSettings ? (
              <Pressable
                accessibilityRole="button"
                onPress={props.onOpenSettings}
                className="px-3 py-2 rounded-md bg-neutral-200 dark:bg-neutral-700"
              >
                <Text className="text-neutral-900 dark:text-neutral-100">Open Settings</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={props.onDismiss}
              className="px-3 py-2 rounded-md bg-primary"
            >
              <Text className="text-white">Got it</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
