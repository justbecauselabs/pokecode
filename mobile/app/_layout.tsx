import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// @ts-ignore - global.css is not a module
import '../global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function HeaderButtons() {
  const router = useRouter();

  return (
    <>
      <Pressable
        onPress={() => router.push('/settings')}
        className="w-10 h-10 bg-muted rounded-full items-center justify-center mr-2"
      >
        <Text className="text-muted-foreground text-lg font-mono">⚙</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/repositories')}
        className="w-10 h-10 bg-primary rounded-full items-center justify-center"
      >
        <Text className="text-primary-foreground text-xl font-bold font-mono">+</Text>
      </Pressable>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after app loads
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" backgroundColor="#282c34" />
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView className="flex-1 bg-background">
          <BottomSheetModalProvider>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#282c34', // One Dark Pro background
                },
                headerTransparent: false,
                headerTintColor: '#abb2bf', // One Dark Pro foreground
                headerTitleStyle: {
                  fontWeight: '600',
                  color: '#abb2bf', // One Dark Pro foreground
                  fontFamily:
                    'JetBrains Mono, Fira Code, SF Mono, Monaco, Menlo, Courier New, monospace',
                },
                contentStyle: {
                  backgroundColor: '#282c34', // One Dark Pro background
                },
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  title: 'Sessions',
                  headerRight: () => <HeaderButtons />,
                }}
              />
              <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
            </Stack>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
