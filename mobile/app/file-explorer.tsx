import { Feather } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { FileExplorer } from '@/components/session/FileExplorer';
import { FileExplorerFilterBottomSheet } from '@/components/session/FileExplorerFilterBottomSheet';
import { useCreateSession } from '@/hooks/useCreateSession';
import { SafeAreaView } from '@/components/common';

export default function FileExplorerScreen() {
  const router = useRouter();
  const { path, showHidden: showHiddenParam } = useLocalSearchParams<{
    path?: string;
    showHidden?: string | string[];
  }>();
  const parseBoolParam = (value: string | string[] | undefined): boolean => {
    if (Array.isArray(value)) return value.length > 0 && (value[0] === '1' || value[0] === 'true');
    return value === '1' || value === 'true';
  };
  const [showHidden, setShowHidden] = useState<boolean>(parseBoolParam(showHiddenParam));

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const createSessionMutation = useCreateSession();

  const handleSelectPath = async (selectedPath: string) => {
    try {
      // Extract folder name from path
      const folderName = selectedPath.split('/').pop() || selectedPath;

      // Create a temporary repository object for session creation
      const tempRepository = {
        folderName,
        path: selectedPath,
        isGitRepository: false, // This will be determined on the server side
        name: folderName, // Add compatibility field
        isGitRepo: false, // Add compatibility field
      };

      const chooseProvider = async (): Promise<'claude-code' | 'codex-cli'> =>
        new Promise((resolve) => {
          Alert.alert('Choose Agent', 'Which provider do you want to use?', [
            { text: 'Claude Code', onPress: () => resolve('claude-code') },
            { text: 'Codex CLI', onPress: () => resolve('codex-cli') },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('claude-code') },
          ]);
        });

      const provider = await chooseProvider();
      await createSessionMutation.mutateAsync({ repository: tempRepository, provider });

      // Navigate back to the main screen
      router.replace('/');
    } catch (error) {
      console.error('Failed to create session from selected path:', error);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: path ? 'Browse Directory' : 'Find Project',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => filterSheetRef.current?.present()}
              className="w-10 h-10 items-center justify-center"
              hitSlop={8}
            >
              <Feather name="filter" size={20} color="#abb2bf" />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView className="flex-1 bg-background">
        <FileExplorer initialPath={path} onSelectPath={handleSelectPath} showHidden={showHidden} />
      </SafeAreaView>
      <FileExplorerFilterBottomSheet
        ref={filterSheetRef}
        showHidden={showHidden}
        onToggleShowHidden={(value) => {
          setShowHidden(value);
          router.setParams({ showHidden: value ? '1' : '0' });
        }}
      />
    </>
  );
}
