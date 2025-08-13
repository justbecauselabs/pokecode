import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, SafeAreaView } from '@/components/common';

export default function NotFoundScreen() {
  // Using system appearance via `dark:` className variants

  return (
    <SafeAreaView>
      <View className="flex-1 items-center justify-center p-5">
        <Text className="text-7xl font-bold mb-2 text-black dark:text-white">404</Text>
        <Text className="text-2xl font-semibold mb-3 text-black/80 dark:text-white/80">
          Page not found
        </Text>
        <Text className="text-base text-center mb-8 text-black/60 dark:text-white/60">
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/" asChild>
          <Button title="Go to Home" style={styles.button} />
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 200,
  },
});
