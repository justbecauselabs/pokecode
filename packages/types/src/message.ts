export type MessageType = 'assistant' | 'user' | 'system' | 'result' | 'error';

export type AssistantMessageType = 'message' | 'tool_use' | 'tool_result';

export type ToolType =
  | 'todo'
  | 'read'
  | 'bash'
  | 'edit'
  | 'multiedit'
  | 'task'
  | 'grep'
  | 'glob'
  | 'ls';

export type TodoToolUseData = {
  todos: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' }>;
};
export type ReadToolUseData = { filePath: string };

export type BashToolUseData = { command: string; timeout?: number; description?: string };

export type EditToolUseData = { filePath: string; oldString: string; newString: string };

export type MultiEditToolUseData = {
  filePath: string;
  edits: Array<{ oldString: string; newString: string; replaceAll?: boolean }>;
};

export type TaskToolUseData = { subagentType: string; description: string; prompt: string };

export type GrepToolUseData = {
  pattern: string;
  path: string;
  outputMode: string;
  lineNumbers?: boolean;
  headLimit?: number;
  contextLines?: number;
};

export type GlobToolUseData = { pattern: string; path?: string };

export type LsToolUseData = { path: string };

export type AssistantMessageToolUse =
  | { type: 'todo'; toolId: string; data: TodoToolUseData }
  | { type: 'read'; toolId: string; data: ReadToolUseData }
  | { type: 'bash'; toolId: string; data: BashToolUseData }
  | { type: 'edit'; toolId: string; data: EditToolUseData }
  | { type: 'multiedit'; toolId: string; data: MultiEditToolUseData }
  | { type: 'task'; toolId: string; data: TaskToolUseData }
  | { type: 'grep'; toolId: string; data: GrepToolUseData }
  | { type: 'glob'; toolId: string; data: GlobToolUseData }
  | { type: 'ls'; toolId: string; data: LsToolUseData };

export type AssistantMessageToolResult = { toolUseId: string; content: string; isError?: boolean };

export type AssistantMessage =
  | { type: 'message'; data: { content: string } }
  | { type: 'tool_use'; data: AssistantMessageToolUse }
  | { type: 'tool_result'; data: AssistantMessageToolResult };

export type UserMessage = { content: string };
export type ErrorMessage = { message: string };

export type Message = {
  id: string;
  type: MessageType;
  data: UserMessage | AssistantMessage | ErrorMessage;
  parentToolUseId: string | null;
};
