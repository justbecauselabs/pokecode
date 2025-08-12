import { vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

/**
 * Utility functions for testing
 */

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a specific amount of time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock function that can be awaited
 */
export function createAsyncMock<T = any>(resolveValue?: T, rejectValue?: any) {
  const mock = vi.fn();
  
  if (rejectValue !== undefined) {
    mock.mockRejectedValue(rejectValue);
  } else {
    mock.mockResolvedValue(resolveValue);
  }
  
  return mock;
}

/**
 * Create a mock function that resolves after a delay
 */
export function createDelayedMock<T = any>(resolveValue: T, delay = 100) {
  return vi.fn(() => new Promise<T>(resolve => 
    setTimeout(() => resolve(resolveValue), delay)
  ));
}

/**
 * Create a spy on console methods that can be restored
 */
export function spyOnConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  };
  
  return { logSpy, errorSpy, warnSpy, restore };
}

/**
 * Mock implementation for file system operations
 */
export function createMockFileSystem() {
  const files: Map<string, string> = new Map();
  const directories: Set<string> = new Set();
  
  return {
    // File operations
    writeFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    
    readFile: vi.fn(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      return files.get(path);
    }),
    
    unlink: vi.fn(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      files.delete(path);
    }),
    
    stat: vi.fn(async (path: string) => {
      if (files.has(path)) {
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: files.get(path)?.length || 0,
          mtime: new Date(),
        };
      }
      
      if (directories.has(path)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          size: 0,
          mtime: new Date(),
        };
      }
      
      throw new Error(`ENOENT: no such file or directory '${path}'`);
    }),
    
    // Directory operations
    mkdir: vi.fn(async (path: string) => {
      directories.add(path);
    }),
    
    readdir: vi.fn(async (path: string) => {
      if (!directories.has(path)) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      
      const contents = [];
      
      // Add files in this directory
      for (const filePath of files.keys()) {
        if (filePath.startsWith(path + '/') && !filePath.substring(path.length + 1).includes('/')) {
          const name = filePath.substring(path.length + 1);
          contents.push({
            name,
            isFile: () => true,
            isDirectory: () => false,
          });
        }
      }
      
      // Add subdirectories
      for (const dirPath of directories) {
        if (dirPath.startsWith(path + '/') && !dirPath.substring(path.length + 1).includes('/')) {
          const name = dirPath.substring(path.length + 1);
          contents.push({
            name,
            isFile: () => false,
            isDirectory: () => true,
          });
        }
      }
      
      return contents;
    }),
    
    // Utility methods for testing
    _addFile: (path: string, content: string) => files.set(path, content),
    _addDirectory: (path: string) => directories.add(path),
    _clear: () => {
      files.clear();
      directories.clear();
    },
    _getFiles: () => new Map(files),
    _getDirectories: () => new Set(directories),
  };
}

/**
 * Create a mock Redis client
 */
export function createMockRedis() {
  const data: Map<string, string> = new Map();
  const subscribers: Map<string, Function[]> = new Map();
  
  return {
    // Basic operations
    get: vi.fn(async (key: string) => data.get(key) || null),
    
    set: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
      return 'OK';
    }),
    
    del: vi.fn(async (key: string) => {
      const existed = data.has(key);
      data.delete(key);
      return existed ? 1 : 0;
    }),
    
    // Pub/Sub operations
    publish: vi.fn(async (channel: string, message: string) => {
      const channelSubscribers = subscribers.get(channel) || [];
      channelSubscribers.forEach(callback => callback(message));
      return channelSubscribers.length;
    }),
    
    subscribe: vi.fn(async (channel: string, callback: Function) => {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, []);
      }
      subscribers.get(channel)!.push(callback);
    }),
    
    unsubscribe: vi.fn(async (channel: string) => {
      subscribers.delete(channel);
    }),
    
    // Connection operations
    ping: vi.fn(async () => 'PONG'),
    quit: vi.fn(async () => 'OK'),
    
    // Utility methods for testing
    _getData: () => new Map(data),
    _getSubscribers: () => new Map(subscribers),
    _clear: () => {
      data.clear();
      subscribers.clear();
    },
  };
}

/**
 * Create a mock BullMQ queue
 */
export function createMockQueue() {
  const jobs: Map<string, any> = new Map();
  let jobIdCounter = 0;
  
  return {
    add: vi.fn(async (name: string, data: any, options?: any) => {
      const jobId = `job-${++jobIdCounter}`;
      const job = {
        id: jobId,
        name,
        data,
        options,
        progress: 0,
        attemptsMade: 0,
        finishedOn: null,
        failedReason: null,
        getState: vi.fn(async () => 'waiting'),
        updateProgress: vi.fn(async (progress: any) => {
          job.progress = progress;
        }),
        remove: vi.fn(async () => {
          jobs.delete(jobId);
        }),
      };
      jobs.set(jobId, job);
      return job;
    }),
    
    getJob: vi.fn(async (jobId: string) => jobs.get(jobId) || null),
    
    getWaitingCount: vi.fn(async () => 
      Array.from(jobs.values()).filter(job => job.getState() === 'waiting').length
    ),
    
    getActiveCount: vi.fn(async () => 
      Array.from(jobs.values()).filter(job => job.getState() === 'active').length
    ),
    
    getCompletedCount: vi.fn(async () => 
      Array.from(jobs.values()).filter(job => job.getState() === 'completed').length
    ),
    
    getFailedCount: vi.fn(async () => 
      Array.from(jobs.values()).filter(job => job.getState() === 'failed').length
    ),
    
    getDelayedCount: vi.fn(async () => 0),
    
    getJobCounts: vi.fn(async () => ({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    })),
    
    close: vi.fn(async () => {}),
    
    // Utility methods for testing
    _getJobs: () => new Map(jobs),
    _clear: () => jobs.clear(),
  };
}

/**
 * Capture and analyze HTTP requests made during tests
 */
export function createRequestCapture() {
  const requests: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: Date;
  }> = [];
  
  const captureRequest = (method: string, url: string, options: any = {}) => {
    requests.push({
      method,
      url,
      headers: options.headers || {},
      body: options.payload || options.body,
      timestamp: new Date(),
    });
  };
  
  return {
    capture: captureRequest,
    getRequests: () => [...requests],
    getRequestCount: () => requests.length,
    getLastRequest: () => requests[requests.length - 1],
    clear: () => requests.length = 0,
    
    // Helper methods for assertions
    hasRequest: (method: string, url: string) => 
      requests.some(req => req.method === method && req.url === url),
    
    getRequestsForUrl: (url: string) => 
      requests.filter(req => req.url === url),
    
    getRequestsForMethod: (method: string) => 
      requests.filter(req => req.method === method),
  };
}

/**
 * Test environment utilities
 */
export const testEnv = {
  /**
   * Temporarily set environment variables for a test
   */
  withEnv: <T>(envVars: Record<string, string>, fn: () => T | Promise<T>): Promise<T> => {
    const originalEnv = { ...process.env };
    
    // Set test environment variables
    Object.assign(process.env, envVars);
    
    return Promise.resolve(fn()).finally(() => {
      // Restore original environment
      process.env = originalEnv;
    });
  },
  
  /**
   * Get a test-specific temporary directory path
   */
  getTempDir: (testName?: string) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const name = testName ? `${testName}-${timestamp}` : `test-${timestamp}-${random}`;
    return `/tmp/pokecode-tests/${name}`;
  },
};

/**
 * Performance testing utilities
 */
export const perfUtils = {
  /**
   * Measure execution time of a function
   */
  measureTime: async <T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },
  
  /**
   * Assert that a function completes within a time limit
   */
  assertWithinTime: async <T>(
    fn: () => T | Promise<T>,
    maxDuration: number,
    message?: string
  ): Promise<T> => {
    const { result, duration } = await perfUtils.measureTime(fn);
    
    if (duration > maxDuration) {
      throw new Error(
        message || `Function took ${duration}ms, expected less than ${maxDuration}ms`
      );
    }
    
    return result;
  },
};

/**
 * Database testing utilities
 */
export const dbUtils = {
  /**
   * Execute a function within a database transaction that gets rolled back
   */
  withTransaction: async <T>(fn: (db: any) => T | Promise<T>): Promise<T> => {
    const { getTestDatabase } = await import('./database.helpers');
    const db = getTestDatabase();
    
    return await db.transaction(async (tx) => {
      const result = await fn(tx);
      // Transaction will be rolled back automatically
      throw new Error('ROLLBACK'); // This causes rollback but we catch it
    }).catch((error) => {
      if (error.message === 'ROLLBACK') {
        // Expected rollback, return the result
        return fn(db); // Re-execute to get the result without transaction
      }
      throw error;
    });
  },
};