import type { Message } from './message';

export type SSEHeartbeatData = Record<string, never>;
export type SSEUpdateData = { state: 'running' | 'done'; message: Message | null };

export type SSEEvent =
  | { type: 'heartbeat'; data: SSEHeartbeatData }
  | { type: 'update'; data: SSEUpdateData };
