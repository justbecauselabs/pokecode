import type { SDKAssistantMessage, SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-code';
import type {
  ContentBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { AssistantMessage, Message, UserMessage } from '@pokecode/api';
import type { SessionMessage } from '../database/schema-sqlite/session_messages';
import { logger } from './logger';

/**
 * Extract token count from an SDK message
 */
export function extractTokenCount(sdkMessage: SDKMessage): number {
  try {
    if (sdkMessage.type === 'assistant') {
      const assistantMsg = sdkMessage as SDKAssistantMessage;
      if (assistantMsg.message?.usage) {
        // Return total tokens (input + output)
        return assistantMsg.message.usage.input_tokens + assistantMsg.message.usage.output_tokens;
      }
    } else if (sdkMessage.type === 'result') {
      const resultMsg = sdkMessage as SDKResultMessage;
      if (resultMsg.usage) {
        // Return total tokens (input + output)
        return resultMsg.usage.input_tokens + resultMsg.usage.output_tokens;
      }
    }
    return 0;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageType: sdkMessage.type,
      },
      'Failed to extract token count from SDK message',
    );
    return 0;
  }
}

/**
 * Parse system message (like cancellation messages) from SDK format
 */
function parseSystemMessage(
  dbMessage: SessionMessage,
  sdkMessage: { type: 'system'; message: { role: string; content: string } },
): Message | null {
  // Handle system messages with assistant role (like cancellation messages)
  if (sdkMessage.message?.content && typeof sdkMessage.message.content === 'string') {
    return {
      id: dbMessage.id,
      type: 'assistant',
      data: {
        type: 'message',
        data: {
          content: sdkMessage.message.content,
        },
      },
      parentToolUseId: null,
    };
  }

  return null;
}

/**
 * Parse user message from SDK format
 */
function parseUserMessage(
  dbMessage: SessionMessage,
  sdkMessage: SDKMessage & { type: 'user' },
): Message | null {
  // Handle string content (normal user messages)
  if (sdkMessage.message?.content && typeof sdkMessage.message.content === 'string') {
    return {
      id: dbMessage.id,
      type: 'user',
      data: {
        content: sdkMessage.message.content,
      },
      parentToolUseId: sdkMessage.parent_tool_use_id,
    };
  }

  // Handle array content (tool results) - these should be mapped to assistant tool_result messages
  if (Array.isArray(sdkMessage.message?.content)) {
    const toolResultBlocks = sdkMessage.message.content.filter(
      (block): block is ToolResultBlockParam =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'tool_result',
    );

    if (toolResultBlocks.length > 0) {
      // Take the first tool result block
      const toolResultBlock = toolResultBlocks[0];

      // Skip if essential fields are missing
      if (!toolResultBlock?.tool_use_id || typeof toolResultBlock?.content !== 'string') {
        return null;
      }

      return {
        id: dbMessage.id,
        type: 'assistant', // Map tool results to assistant messages
        data: {
          type: 'tool_result',
          data: {
            toolUseId: toolResultBlock.tool_use_id,
            content: toolResultBlock.content,
            isError: toolResultBlock.is_error,
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }
  }

  return null;
}

/**
 * Parse TodoWrite tool use from content blocks
 */
function parseTodoWriteToolUse(toolUseBlocks: Array<ToolUseBlockParam>): {
  toolId: string;
  todos: Array<{
    content: string;
    status: 'completed' | 'pending' | 'in_progress';
    id?: string;
  }>;
} | null {
  const todoWriteBlock = toolUseBlocks.find((block) => block.name === 'TodoWrite');

  if (todoWriteBlock) {
    const input = todoWriteBlock.input as {
      todos?: Array<{
        content: string;
        status: 'completed' | 'pending' | 'in_progress';
        id?: string;
      }>;
    };

    if (input?.todos && todoWriteBlock.id) {
      return { toolId: todoWriteBlock.id, todos: input.todos };
    }
  }
  return null;
}

/**
 * Parse Read tool use from content blocks
 */
function parseReadToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  filePath: string;
} | null {
  const readBlock = toolUseBlocks.find((block) => block.name === 'Read');

  if (readBlock) {
    const input = readBlock.input as { file_path?: string };

    if (input?.file_path && readBlock.id) {
      let filePath = input.file_path;

      // If project path is provided and the file path starts with it, show relative path
      if (projectPath && filePath.startsWith(projectPath)) {
        const relativePath = filePath.slice(projectPath.length);
        // Remove leading slash if present
        filePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      return { toolId: readBlock.id, filePath };
    }
  }
  return null;
}

/**
 * Parse Bash tool use from content blocks
 */
function parseBashToolUse(toolUseBlocks: Array<ToolUseBlockParam>): {
  toolId: string;
  command: string;
  timeout?: number;
  description?: string;
} | null {
  const bashBlock = toolUseBlocks.find((block) => block.name === 'Bash');

  if (bashBlock) {
    const input = bashBlock.input as {
      command?: string;
      timeout?: number;
      description?: string;
    };

    if (input?.command && bashBlock.id) {
      const result: {
        toolId: string;
        command: string;
        timeout?: number;
        description?: string;
      } = {
        toolId: bashBlock.id,
        command: input.command,
      };

      if (input.timeout !== undefined) {
        result.timeout = input.timeout;
      }

      if (input.description !== undefined) {
        result.description = input.description;
      }

      return result;
    }
  }
  return null;
}

/**
 * Parse Edit tool use from content blocks
 */
function parseEditToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  filePath: string;
  oldString: string;
  newString: string;
} | null {
  const editBlock = toolUseBlocks.find((block) => block.name === 'Edit');

  if (editBlock) {
    const input = editBlock.input as {
      file_path?: string;
      old_string?: string;
      new_string?: string;
    };

    if (input?.file_path && input?.old_string && input?.new_string && editBlock.id) {
      let filePath = input.file_path;

      // If project path is provided and the file path starts with it, show relative path
      if (projectPath && filePath.startsWith(projectPath)) {
        const relativePath = filePath.slice(projectPath.length);
        // Remove leading slash if present
        filePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      return {
        toolId: editBlock.id,
        filePath,
        oldString: input.old_string,
        newString: input.new_string,
      };
    }
  }
  return null;
}

/**
 * Parse MultiEdit tool use from content blocks
 */
function parseMultiEditToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  filePath: string;
  edits: Array<{
    oldString: string;
    newString: string;
    replaceAll?: boolean;
  }>;
} | null {
  const multiEditBlock = toolUseBlocks.find((block) => block.name === 'MultiEdit');

  if (multiEditBlock) {
    const input = multiEditBlock.input as {
      file_path?: string;
      edits?: Array<{
        old_string?: string;
        new_string?: string;
        replace_all?: boolean;
      }>;
    };

    if (input?.file_path && input?.edits && multiEditBlock.id) {
      let filePath = input.file_path;

      // If project path is provided and the file path starts with it, show relative path
      if (projectPath && filePath.startsWith(projectPath)) {
        const relativePath = filePath.slice(projectPath.length);
        // Remove leading slash if present
        filePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      // Validate and transform edits
      const validEdits = input.edits
        .filter((edit) => edit.old_string && edit.new_string)
        .map((edit) => {
          const result: {
            oldString: string;
            newString: string;
            replaceAll?: boolean;
          } = {
            oldString: edit.old_string as string,
            newString: edit.new_string as string,
          };

          if (edit.replace_all !== undefined) {
            result.replaceAll = edit.replace_all;
          }

          return result;
        });

      if (validEdits.length > 0) {
        return {
          toolId: multiEditBlock.id,
          filePath,
          edits: validEdits,
        };
      }
    }
  }
  return null;
}

/**
 * Parse Task tool use from content blocks
 */
function parseTaskToolUse(toolUseBlocks: Array<ToolUseBlockParam>): {
  toolId: string;
  subagentType: string;
  description: string;
  prompt: string;
} | null {
  const taskBlock = toolUseBlocks.find((block) => block.name === 'Task');

  if (taskBlock) {
    const input = taskBlock.input as {
      subagent_type?: string;
      description?: string;
      prompt?: string;
    };

    if (input?.subagent_type && input?.description && input?.prompt && taskBlock.id) {
      return {
        toolId: taskBlock.id,
        subagentType: input.subagent_type,
        description: input.description,
        prompt: input.prompt,
      };
    }
  }
  return null;
}

/**
 * Parse Grep tool use from content blocks
 */
function parseGrepToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  pattern: string;
  path: string;
  outputMode: string;
  lineNumbers?: boolean;
  headLimit?: number;
  contextLines?: number;
} | null {
  const grepBlock = toolUseBlocks.find((block) => block.name === 'Grep');

  if (grepBlock) {
    const input = grepBlock.input as {
      pattern?: string;
      path?: string;
      output_mode?: string;
      '-n'?: boolean;
      head_limit?: number;
      '-C'?: number;
    };

    if (input?.pattern && input?.path && input?.output_mode && grepBlock.id) {
      let path = input.path;

      // If project path is provided and the path starts with it, show relative path
      if (projectPath && path.startsWith(projectPath)) {
        const relativePath = path.slice(projectPath.length);
        // Remove leading slash if present
        path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      const result: {
        toolId: string;
        pattern: string;
        path: string;
        outputMode: string;
        lineNumbers?: boolean;
        headLimit?: number;
        contextLines?: number;
      } = {
        toolId: grepBlock.id,
        pattern: input.pattern,
        path,
        outputMode: input.output_mode,
      };

      if (input['-n'] !== undefined) {
        result.lineNumbers = input['-n'];
      }

      if (input.head_limit !== undefined) {
        result.headLimit = input.head_limit;
      }

      if (input['-C'] !== undefined) {
        result.contextLines = input['-C'];
      }

      return result;
    }
  }
  return null;
}

/**
 * Parse Glob tool use from content blocks
 */
function parseGlobToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  pattern: string;
  path?: string;
} | null {
  const globBlock = toolUseBlocks.find((block) => block.name === 'Glob');

  if (globBlock) {
    const input = globBlock.input as {
      pattern?: string;
      path?: string;
    };

    if (input?.pattern && globBlock.id) {
      let path = input.path;

      // If project path is provided and the path starts with it, show relative path
      if (projectPath && path && path.startsWith(projectPath)) {
        const relativePath = path.slice(projectPath.length);
        // Remove leading slash if present
        path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      const result: {
        toolId: string;
        pattern: string;
        path?: string;
      } = {
        toolId: globBlock.id,
        pattern: input.pattern,
      };

      if (path !== undefined) {
        result.path = path;
      }

      return result;
    }
  }
  return null;
}

/**
 * Parse LS tool use from content blocks
 */
function parseLsToolUse(
  toolUseBlocks: Array<ToolUseBlockParam>,
  projectPath?: string,
): {
  toolId: string;
  path: string;
} | null {
  const lsBlock = toolUseBlocks.find((block) => block.name === 'LS');

  if (lsBlock) {
    const input = lsBlock.input as {
      path?: string;
    };

    if (input?.path && lsBlock.id) {
      let path = input.path;

      // If project path is provided and the path starts with it, show relative path
      if (projectPath && path.startsWith(projectPath)) {
        const relativePath = path.slice(projectPath.length);
        // Remove leading slash if present
        path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      }

      return {
        toolId: lsBlock.id,
        path,
      };
    }
  }
  return null;
}

/**
 * Extract text content from assistant message content blocks
 */
function extractTextContent(content: Array<ContentBlockParam>): string {
  return content
    .filter(
      (block): block is TextBlockParam =>
        block.type === 'text' && 'text' in block && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('\n');
}

/**
 * Parse assistant message from SDK format
 */
function parseAssistantMessage(
  dbMessage: SessionMessage,
  sdkMessage: SDKMessage & { type: 'assistant' },
  projectPath?: string,
): Message | null {
  if (!Array.isArray(sdkMessage.message?.content)) {
    return null;
  }

  // Check for tool use calls first
  const toolUseBlocks = sdkMessage.message.content.filter(
    (block): block is ToolUseBlockParam =>
      typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_use',
  );

  if (toolUseBlocks.length > 0) {
    // Handle TodoWrite tool specifically
    const todoData = parseTodoWriteToolUse(toolUseBlocks);
    if (todoData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'todo',
            toolId: todoData.toolId,
            data: {
              todos: todoData.todos,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Task tool specifically
    const taskData = parseTaskToolUse(toolUseBlocks);
    if (taskData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'task',
            toolId: taskData.toolId,
            data: {
              subagentType: taskData.subagentType,
              description: taskData.description,
              prompt: taskData.prompt,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Grep tool specifically
    const grepData = parseGrepToolUse(toolUseBlocks, projectPath);
    if (grepData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'grep',
            toolId: grepData.toolId,
            data: {
              pattern: grepData.pattern,
              path: grepData.path,
              outputMode: grepData.outputMode,
              lineNumbers: grepData.lineNumbers,
              headLimit: grepData.headLimit,
              contextLines: grepData.contextLines,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Glob tool specifically
    const globData = parseGlobToolUse(toolUseBlocks, projectPath);
    if (globData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'glob',
            toolId: globData.toolId,
            data: {
              pattern: globData.pattern,
              path: globData.path,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle LS tool specifically
    const lsData = parseLsToolUse(toolUseBlocks, projectPath);
    if (lsData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'ls',
            toolId: lsData.toolId,
            data: {
              path: lsData.path,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Bash tool specifically
    const bashData = parseBashToolUse(toolUseBlocks);
    if (bashData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'bash',
            toolId: bashData.toolId,
            data: {
              command: bashData.command,
              timeout: bashData.timeout,
              description: bashData.description,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Edit tool specifically
    const editData = parseEditToolUse(toolUseBlocks, projectPath);
    if (editData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'edit',
            toolId: editData.toolId,
            data: {
              filePath: editData.filePath,
              oldString: editData.oldString,
              newString: editData.newString,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle MultiEdit tool specifically
    const multiEditData = parseMultiEditToolUse(toolUseBlocks, projectPath);
    if (multiEditData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'multiedit',
            toolId: multiEditData.toolId,
            data: {
              filePath: multiEditData.filePath,
              edits: multiEditData.edits,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }

    // Handle Read tool specifically
    const readData = parseReadToolUse(toolUseBlocks, projectPath);
    if (readData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'read',
            toolId: readData.toolId,
            data: {
              filePath: readData.filePath,
            },
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }
  }

  // Fallback to text content extraction
  const textContent = extractTextContent(sdkMessage.message.content);
  if (textContent) {
    return {
      id: dbMessage.id,
      type: 'assistant',
      data: {
        type: 'message',
        data: {
          content: textContent,
        },
      },
      parentToolUseId: sdkMessage.parent_tool_use_id,
    };
  }

  return null;
}

/**
 * Parse DB message to new Message format
 */
export function parseDbMessage(dbMessage: SessionMessage, projectPath?: string): Message | null {
  try {
    // Parse the contentData JSON string to get the SDK message
    if (!dbMessage.contentData) {
      return null;
    }

    const sdkMessage = JSON.parse(dbMessage.contentData);

    // Check if it's a user message with text content
    if (dbMessage.type === 'user' && sdkMessage.type === 'user') {
      return parseUserMessage(dbMessage, sdkMessage as SDKMessage & { type: 'user' });
    }

    // Check if it's an assistant message
    if (dbMessage.type === 'assistant' && sdkMessage.type === 'assistant') {
      return parseAssistantMessage(
        dbMessage,
        sdkMessage as SDKMessage & { type: 'assistant' },
        projectPath,
      );
    }

    // Check if it's a system message (like cancellation messages)
    if (dbMessage.type === 'assistant' && sdkMessage.type === 'system') {
      return parseSystemMessage(dbMessage, sdkMessage);
    }

    return null;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        dbMessage,
      },
      'Failed to parse DB message',
    );
    return null;
  }
}

/**
 * Extract simple text content from new Message format for display purposes
 */
export function extractMessageText(message: Message): string {
  try {
    if (message.type === 'user') {
      const userData = message.data as UserMessage;
      return userData.content;
    }

    if (message.type === 'assistant') {
      const assistantData = message.data as AssistantMessage;

      if (assistantData.type === 'message') {
        return assistantData.data.content;
      }

      if (assistantData.type === 'tool_use') {
        const toolUse = assistantData.data;

        if (toolUse.type === 'todo') {
          return '[Todo list updated]';
        }

        if (toolUse.type === 'read') {
          return `[Reading file: ${toolUse.data.filePath}]`;
        }

        if (toolUse.type === 'bash') {
          if (toolUse.data.description) {
            return `[Running: ${toolUse.data.description}]`;
          }

          // Show first 50 chars of command if no description
          const commandPreview =
            toolUse.data.command.length > 50
              ? `${toolUse.data.command.substring(0, 50)}...`
              : toolUse.data.command;
          return `[Running command: ${commandPreview}]`;
        }

        if (toolUse.type === 'edit') {
          return `[Editing file: ${toolUse.data.filePath}]`;
        }

        if (toolUse.type === 'multiedit') {
          return `[Multi-editing file: ${toolUse.data.filePath} (${toolUse.data.edits.length} edits)]`;
        }

        if (toolUse.type === 'task') {
          return `[Launching ${toolUse.data.subagentType} agent: ${toolUse.data.description}]`;
        }

        if (toolUse.type === 'grep') {
          return `[Searching for "${toolUse.data.pattern}" in ${toolUse.data.path}]`;
        }

        if (toolUse.type === 'glob') {
          const pathText = toolUse.data.path ? ` in ${toolUse.data.path}` : '';
          return `[Finding files matching "${toolUse.data.pattern}"${pathText}]`;
        }

        if (toolUse.type === 'ls') {
          return `[Listing directory: ${toolUse.data.path}]`;
        }

        return '[Tool used]';
      }

      if (assistantData.type === 'tool_result') {
        if (assistantData.data.isError) {
          return '[Tool execution failed]';
        }

        // Show a preview of the tool result content (first 100 chars)
        const preview = assistantData.data.content.substring(0, 100);
        return `[Tool result: ${preview}${assistantData.data.content.length > 100 ? '...' : ''}]`;
      }
    }

    if (message.type === 'system') {
      return '[System message]';
    }

    if (message.type === 'result') {
      return '[Result message]';
    }

    return '[Unknown message type]';
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.id,
      },
      'Failed to extract text from new message format',
    );
    return '[Failed to extract content]';
  }
}
