export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolUses?: ToolUse[];
  codeBlocks?: CodeBlock[];
}

export interface ToolUse {
  id: string;
  name: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

export interface StreamMessage {
  type: 'content' | 'tool_use' | 'tool_result' | 'error' | 'complete';
  content?: string;
  toolUse?: ToolUse;
  error?: string;
}

export interface CreatePromptData {
  sessionId: string;
  prompt: string;
  templates?: PromptTemplate[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables?: string[];
}

export interface Prompt {
  id: string;
  sessionId: string;
  userId: string;
  prompt: string;
  response?: string;
  toolUses?: ToolUse[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}