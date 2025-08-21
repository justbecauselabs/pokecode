import { createWriteStream } from 'node:fs';
import pino, { type StreamEntry } from 'pino';
import pinoPretty from 'pino-pretty';
import { config } from '../config';

const isDevelopment = config.NODE_ENV === 'development';

// Create streams array for multistream
const streams: StreamEntry[] = [];

// Add console stream with pretty printing in development
if (isDevelopment) {
  streams.push({
    level: config.LOG_LEVEL || 'trace',
    stream: pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }),
  });
} else {
  // In production, write to stdout
  streams.push({
    level: config.LOG_LEVEL || 'info',
    stream: process.stdout,
  });
}

// Always add file stream for server.log
streams.push({
  level: config.LOG_LEVEL || (isDevelopment ? 'trace' : 'info'),
  stream: createWriteStream('./server.log', { flags: 'a' }),
});

// Create multistream logger
export const logger = pino(
  {
    level: config.LOG_LEVEL || (isDevelopment ? 'trace' : 'info'),
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams),
);

export const createChildLogger = (name: string) => {
  return logger.child({ module: name });
};
