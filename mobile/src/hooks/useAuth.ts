import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  const requireAuth = () => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    requireAuth,
  };
}