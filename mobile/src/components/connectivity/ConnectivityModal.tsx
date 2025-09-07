import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onOpenSettings?: () => void;
};

export function ConnectivityModal(props: Props) {
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

        <View className="gap-3">
          {props.onOpenSettings ? (
            <Pressable
              accessibilityRole="button"
              onPress={props.onOpenSettings}
              className="w-full items-center justify-center rounded-md bg-primary py-3"
            >
              <Text className="text-primary-foreground text-base font-semibold">Open Backend Settings</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
