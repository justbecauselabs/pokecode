import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import pino, { type StreamEntry } from 'pino';
import pinoPretty from 'pino-pretty';
import { isTest, LOG_FILE } from '../config';

// Create simple logger with sensible defaults
// Config file can override log level via server startup
const defaultLogLevel = 'info';

// Create streams array for multistream
const streams: StreamEntry[] = [];

// Add console stream with pretty printing when interactive, not in tests/daemon/TUI
const enableConsolePretty = !isTest && process.stdout.isTTY && process.env.POKECODE_TUI !== '1';
if (enableConsolePretty) {
  streams.push({
    level: defaultLogLevel,
    stream: pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }),
  });
}

// Always add file stream to LOG_FILE (except in tests)
if (!isTest) {
  // Ensure log directory exists
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  } catch (_error) {
    // Directory might already exist
  }

  streams.push({
    level: defaultLogLevel,
    stream: createWriteStream(LOG_FILE, { flags: 'a' }),
  });
}

// Create multistream logger
export const logger = pino(
  {
    level: defaultLogLevel,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  streams.length > 0 ? pino.multistream(streams) : undefined,
);

export const createChildLogger = (name: string) => {
  return logger.child({ module: name });
};
