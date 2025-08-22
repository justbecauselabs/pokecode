import { createWriteStream } from 'node:fs';
import pino, { type StreamEntry } from 'pino';
import pinoPretty from 'pino-pretty';
import { isTest } from '../config';

// Create simple logger with sensible defaults
// Config file can override log level via server startup
const defaultLogLevel = 'info';

// Create streams array for multistream
const streams: StreamEntry[] = [];

// Add console stream with pretty printing (but not in tests)
if (!isTest) {
  streams.push({
    level: defaultLogLevel,
    stream: pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }),
  });
}

// Always add file stream for server.log (except in tests)
if (!isTest) {
  streams.push({
    level: defaultLogLevel,
    stream: createWriteStream('./server.log', { flags: 'a' }),
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
