import type { SDKMessage as ClaudeSDKMessage } from '@anthropic-ai/claude-code';
import type { CodexSDKMessage, Provider } from '@pokecode/types';

// AgentRunner is the minimal interface implemented by concrete runners

export interface RunnerExecuteParams {
  sessionId: string;
  projectPath: string;
  prompt: string;
  model?: string;
  abortController: AbortController;
}

export type RunnerStreamItem = {
  provider: Provider; // e.g., 'claude-code'
  providerSessionId: string | null; // provider-side session id if available
  message: ClaudeSDKMessage | CodexSDKMessage; // provider-typed message
};

export interface AgentRunner {
  execute(params: RunnerExecuteParams): AsyncIterable<RunnerStreamItem>;
  abort(): Promise<void>;
}

// No factory here; concrete runners (e.g., ClaudeCodeRunner) implement AgentRunner directly.
