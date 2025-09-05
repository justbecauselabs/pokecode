import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CustomBottomSheet } from '../common';

export const SessionOptionsBottomSheet = forwardRef<BottomSheetModal>((_, ref) => {
  const router = useRouter();

  const handleClose = useCallback(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.close();
    }
  }, [ref]);

  const handleRepositoriesPress = useCallback(() => {
    handleClose();
    router.push('/repository-list');
  }, [router, handleClose]);

  const handleFileExplorerPress = useCallback(() => {
    handleClose();
    router.push('/file-explorer');
  }, [router, handleClose]);

  return (
    <CustomBottomSheet ref={ref} enablePanDownToClose onClose={handleClose}>
      <Text className="text-lg font-semibold text-foreground font-mono mb-4 text-center px-6">
        Start New Session
      </Text>

      <View>
        <Pressable onPress={handleRepositoriesPress} className="py-4 px-6 active:opacity-80">
          <View className="flex-row items-center">
            <Text className="text-foreground text-lg font-mono mr-3">📁</Text>
            <View className="flex-1">
              <Text className="text-foreground text-base font-semibold font-mono">
                Recent Repositories
              </Text>
              <Text className="text-muted-foreground text-sm font-mono">
                Choose from your configured repositories
              </Text>
            </View>
          </View>
        </Pressable>

        <View className="h-px bg-border mx-6" />

        <Pressable onPress={handleFileExplorerPress} className="py-4 px-6 active:opacity-80">
          <View className="flex-row items-center">
            <Text className="text-foreground text-lg font-mono mr-3">🔍</Text>
            <View className="flex-1">
              <Text className="text-foreground text-base font-semibold font-mono">
                Find a Project
              </Text>
              <Text className="text-muted-foreground text-sm font-mono">
                Browse directories on your computer
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    </CustomBottomSheet>
  );
});
