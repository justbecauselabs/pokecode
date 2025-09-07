import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiClient } from '@/api/client';

export type PollState = {
  isConnected: boolean;
  showServerNeededModal: boolean;
  lastServerTime?: string;
  pollIntervalMs: number;
};

export type PollerConfig = {
  deviceId?: string;
  deviceName: string;
  platform: 'ios' | 'android';
  appVersion?: string;
  initialIntervalMs?: number; // default 5000
  failureThreshold?: number; // default 2
};

export function useConnectivityPoller(config: PollerConfig): PollState {
  const [state, setState] = useState<PollState>({
    isConnected: false,
    showServerNeededModal: false,
    pollIntervalMs: config.initialIntervalMs ?? 5000,
  });

  const failuresRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const appStateRef = useRef<string>(AppState.currentState);
  const failureThreshold = config.failureThreshold ?? 2;

  const pollOnce = useCallback(async () => {
    if (!config.deviceId) {
      // No identity yet; do not attempt polling
      return;
    }
    try {
      const data = await apiClient.connect({
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        platform: config.platform,
        appVersion: config.appVersion,
      });
      failuresRef.current = 0;
      setState((prev) => ({
        ...prev,
        isConnected: true,
        showServerNeededModal: false,
        lastServerTime: data.server_time,
        pollIntervalMs: data.poll_interval_s * 1000,
      }));
      return;
    } catch (_error) {
      // Treat all errors as connectivity failures
      failuresRef.current += 1;
    }

    if (failuresRef.current > 0) {
      const shouldShow = failuresRef.current >= failureThreshold;
      setState((prev) => ({
        ...prev,
        isConnected: false,
        showServerNeededModal: shouldShow,
      }));
    }
  }, [config.deviceId, config.deviceName, config.platform, config.appVersion, failureThreshold]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    const start = () => {
      clearTimer();
      timerRef.current = setInterval(() => {
        void pollOnce();
      }, state.pollIntervalMs);
      void pollOnce();
    };

    if (appStateRef.current === 'active') {
      start();
    }

    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (next === 'active') {
        start();
      } else {
        clearTimer();
      }
    });

    return () => {
      sub.remove();
      clearTimer();
    };
  }, [pollOnce, state.pollIntervalMs, clearTimer]);

  return state;
}
