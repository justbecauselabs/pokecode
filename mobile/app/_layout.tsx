import { type BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '@/components/common';
import { SessionOptionsBottomSheet } from '@/components/session/SessionOptionsBottomSheet';

// @ts-expect-error - global.css is not a module
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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePlusPress = () => {
    bottomSheetModalRef.current?.present();
  };

  return (
    <>
      <Pressable onPress={handlePlusPress} className="w-10 h-10 items-center justify-center">
        <Text className="text-foreground text-xl font-bold font-mono">+</Text>
      </Pressable>
      <SessionOptionsBottomSheet ref={bottomSheetModalRef} />
    </>
  );
}

function HeaderLeftButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      className="w-10 h-10 items-center justify-center ml-2"
    >
      <Text className="text-foreground text-lg font-mono">⚙</Text>
    </Pressable>
  );
}

function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="w-10 h-10 items-center justify-center ml-2"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={24} color="#abb2bf" />
    </Pressable>
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
                // Show only the back arrow (no text) across all screens
                headerBackTitleVisible: false,
                headerBackTitle: '',
                headerBackVisible: false,
                headerLeft: ({ canGoBack }) => (canGoBack ? <BackButton /> : undefined),
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
                  headerLeft: HeaderLeftButton,
                  headerRight: HeaderButtons,
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
