import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

// Secure storage for sensitive data
export const secureStorage = {
  async setAuthToken(token: string) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  },

  async getAuthToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  },

  async removeAuthToken() {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  },

  async setRefreshToken(token: string) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async removeRefreshToken() {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearAll() {
    await Promise.all([
      this.removeAuthToken(),
      this.removeRefreshToken(),
    ]);
  },
};

// Regular storage for non-sensitive data
export const storage = {
  async setItem(key: string, value: any) {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  },

  async getItem<T>(key: string): Promise<T | null> {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },

  async clear() {
    await AsyncStorage.clear();
  },

  async setUser(user: any) {
    await this.setItem(USER_KEY, user);
  },

  async getUser() {
    return await this.getItem(USER_KEY);
  },

  async removeUser() {
    await this.removeItem(USER_KEY);
  },
};

// Export convenience functions
export const getAuthToken = secureStorage.getAuthToken;
export const setAuthToken = secureStorage.setAuthToken;
export const removeAuthToken = secureStorage.removeAuthToken;
export const getRefreshToken = secureStorage.getRefreshToken;
export const setRefreshToken = secureStorage.setRefreshToken;
export const removeRefreshToken = secureStorage.removeRefreshToken;

export async function refreshAuthToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    // TODO: Implement actual refresh logic with API
    // This is a placeholder - implement your refresh endpoint call
    // @ts-ignore - Expo provides process.env at build time
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    await setAuthToken(data.token);
    if (data.refreshToken) {
      await setRefreshToken(data.refreshToken);
    }

    return data.token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}