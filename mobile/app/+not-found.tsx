import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';

export default function NotFoundScreen() {
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>404</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Page not found
        </Text>
        <Text style={[styles.description, { color: theme.colors.textTertiary }]}>
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/(tabs)" asChild>
          <Button title="Go to Home" style={styles.button} />
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 72,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    minWidth: 200,
  },
});