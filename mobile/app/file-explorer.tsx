import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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

      await createSessionMutation.mutateAsync({ repository: tempRepository });

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
