import AsyncStorage from '@react-native-async-storage/async-storage';

// General storage for app data
export const storage = {
  async setItem<T>(params: { key: string; value: T }): Promise<void> {
    const jsonValue = JSON.stringify(params.value);
    await AsyncStorage.setItem(params.key, jsonValue);
  },

  async getItem<T>(params: { key: string }): Promise<T | null> {
    const jsonValue = await AsyncStorage.getItem(params.key);
    return jsonValue != null ? (JSON.parse(jsonValue) as T) : null;
  },

  async removeItem(params: { key: string }): Promise<void> {
    await AsyncStorage.removeItem(params.key);
  },

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};
