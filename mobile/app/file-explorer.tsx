import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { FileExplorer } from '@/components/session/FileExplorer';
import { useCreateSession } from '@/hooks/useCreateSession';

export default function FileExplorerScreen() {
  const router = useRouter();
  const { path } = useLocalSearchParams<{
    path?: string;
  }>();
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
      <Stack.Screen options={{ title: path ? 'Browse Directory' : 'Find Project' }} />
      <FileExplorer initialPath={path} onSelectPath={handleSelectPath} />
    </>
  );
}
