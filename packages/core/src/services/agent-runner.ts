// AgentRunner is the minimal interface implemented by concrete runners

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

// No factory here; concrete runners (e.g., ClaudeCodeRunner) implement AgentRunner directly.
