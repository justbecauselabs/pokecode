import { Feather } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { ClaudeModel } from '@pokecode/api';
import { getModelDisplayName } from '@pokecode/api';
import { forwardRef, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CustomBottomSheet } from '../common';

interface ModelSelectionBottomSheetProps {
  models: ClaudeModel[];
  selectedModel: string;
  isLoading?: boolean;
  error?: Error | null;
  onSelectModel: (params: { modelId: string }) => void;
  onClose: () => void;
}

export const ModelSelectionBottomSheet = forwardRef<
  BottomSheetModal,
  ModelSelectionBottomSheetProps
>(({ models, selectedModel, isLoading, error, onSelectModel, onClose }, ref) => {
  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handleModelSelect = (modelId: string) => {
    onSelectModel({ modelId });
  };

  const renderModelItem = (model: ClaudeModel) => {
    const isSelected = selectedModel === model;
    const displayName = getModelDisplayName(model);

    return (
      <TouchableOpacity
        key={model}
        className="flex-row items-center py-3 px-4 border-b border-border active:opacity-70"
        onPress={() => handleModelSelect(model)}
        activeOpacity={0.7}
      >
        <View className="flex-1 mr-3">
          <Text className="text-base font-mono text-foreground">{displayName}</Text>
          <Text className="text-sm text-muted-foreground mt-1 font-mono" numberOfLines={1}>
            {model}
          </Text>
        </View>

        {/* Selection indicator */}
        <View className="w-6 h-6 items-center justify-center">
          {isSelected && <Feather name="check" size={16} className="text-primary" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <CustomBottomSheet
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enablePanDownToClose={true}
    >
      <View className="flex-1">
        <View className="px-4 py-3 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">Select Claude Model</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Choose the AI model for this session
          </Text>
        </View>

        <BottomSheetScrollView className="flex-1">
          {isLoading && (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-muted-foreground">Loading models...</Text>
            </View>
          )}

          {error && (
            <View className="flex-1 items-center justify-center py-8 px-4">
              <Feather name="alert-circle" size={24} className="text-destructive mb-2" />
              <Text className="text-destructive text-center font-medium">
                Failed to load models
              </Text>
              <Text className="text-muted-foreground text-center text-sm mt-1">
                {error.message}
              </Text>
            </View>
          )}

          {!isLoading && !error && models.length === 0 && (
            <View className="flex-1 items-center justify-center py-8">
              <Feather name="inbox" size={24} className="text-muted-foreground mb-2" />
              <Text className="text-muted-foreground">No models available</Text>
            </View>
          )}

          {!isLoading && !error && models.length > 0 && (
            <View className="py-2">{models.map(renderModelItem)}</View>
          )}
        </BottomSheetScrollView>
      </View>
    </CustomBottomSheet>
  );
});

ModelSelectionBottomSheet.displayName = 'ModelSelectionBottomSheet';
