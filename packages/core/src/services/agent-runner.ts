import type { Provider } from '@pokecode/types';

export interface RunnerExecuteParams {
  sessionId: string;
  projectPath: string;
  prompt: string;
  model?: string;
  abortController: AbortController;
}

export type RunnerResult =
  | { success: true; durationMs: number }
  | { success: false; error: string; durationMs: number };

export interface AgentRunner {
  execute(params: RunnerExecuteParams): Promise<RunnerResult>;
  abort(): Promise<void>;
}

export interface RunnerFactoryOptions {
  provider: Provider;
  sessionId: string;
  projectPath: string;
  model?: string;
}

export interface RunnerFactory {
  create(options: RunnerFactoryOptions): AgentRunner;
}
