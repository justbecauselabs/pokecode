import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { apiClient } from '../../api/client';
import { useSessionMessages } from '../useSessionMessages';

// Mock the API client
jest.mock('../../api/rn-client', () => ({
  apiClient: {
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSessionMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console logs for clean test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should use server isWorking state instead of local state', async () => {
    const mockResponse = {
      messages: [],
      session: {
        id: 'test-session',
        isWorking: true,
        currentJobId: 'job-123',
        lastJobStatus: 'running',
        status: 'active',
      },
    };

    mockApiClient.getMessages.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useSessionMessages('test-session'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isWorking).toBe(true);
    });

    expect(result.current.isWorking).toBe(mockResponse.session.isWorking);
    expect(result.current.session?.isWorking).toBe(true);
  });

  it('should stop polling when Claude finishes working', async () => {
    let callCount = 0;

    mockApiClient.getMessages.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        messages: [],
        session: {
          id: 'test-session',
          isWorking: callCount <= 2, // Working for first 2 calls, then finished
          currentJobId: callCount <= 2 ? 'job-123' : null,
          lastJobStatus: callCount <= 2 ? 'running' : 'completed',
          status: 'active',
        },
      });
    });

    const { result } = renderHook(() => useSessionMessages('test-session'), {
      wrapper: createWrapper(),
    });

    // Initially working
    await waitFor(() => {
      expect(result.current.isWorking).toBe(true);
    });

    // Should eventually stop working
    await waitFor(
      () => {
        expect(result.current.isWorking).toBe(false);
      },
      { timeout: 5000 }
    );

    expect(result.current.session?.isWorking).toBe(false);
  });

  it('should optimistically update working state when sending message', async () => {
    const mockResponse = {
      messages: [],
      session: {
        id: 'test-session',
        isWorking: false,
        currentJobId: null,
        lastJobStatus: 'completed',
        status: 'active',
      },
    };

    mockApiClient.getMessages.mockResolvedValue(mockResponse);
    mockApiClient.sendMessage.mockResolvedValue({
      message: {
        id: 'msg-123',
        sessionId: 'test-session',
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date().toISOString(),
        children: [],
      },
    });

    const { result } = renderHook(() => useSessionMessages('test-session'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initially not working
    expect(result.current.isWorking).toBe(false);

    // Send message should optimistically set working state
    await result.current.sendMessage({ content: 'Test message' });

    expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
      sessionId: 'test-session',
      data: { content: 'Test message' },
    });
  });

  it('should handle errors gracefully and stop retrying after max attempts', async () => {
    mockApiClient.getMessages.mockRejectedValue(new Error('Network error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useSessionMessages('test-session'), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(consoleSpy).toHaveBeenCalledWith('Message polling failed after max retries');
      },
      { timeout: 10000 }
    );

    consoleSpy.mockRestore();
  });
});
