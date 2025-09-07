import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'pokecode:device_id';

function uuidv4(): string {
  // Non-cryptographic UUID-like ID (sufficient for local dev identity)
  const rnd = (): string =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  const part1 = rnd();
  const part2 = rnd().slice(0, 4);
  const part3 = `4${rnd().slice(1, 4)}`;
  const part4 = `${((8 + Math.floor(Math.random() * 4)) & 0xf).toString(16)}${rnd().slice(1, 4)}`;
  const part5 = `${rnd()}${rnd().slice(0, 4)}`;
  return `${part1.slice(0, 8)}-${part2}-${part3}-${part4}-${part5.slice(0, 12)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length > 0) {
    return existing;
  }
  const id = uuidv4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getDefaultDeviceName(): string {
  const base = Platform.OS === 'ios' ? 'iPhone' : 'Android';
  const name = `PokéCode ${base}`;
  return name.length > 128 ? name.slice(0, 128) : name;
}

export function useDeviceIdentity(): { deviceId?: string; deviceName: string; loading: boolean } {
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateDeviceId();
        if (!cancelled) {
          setDeviceId(id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { deviceId, deviceName: getDefaultDeviceName(), loading };
}
