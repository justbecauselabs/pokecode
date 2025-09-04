import { describe, it, expect } from 'bun:test';
import { parseCodexDbMessage } from '../src/utils/codex-message-parser';
import type { SessionMessage } from '../src/database/schema-sqlite/session_messages';

function makeDbMessage(params: { id?: string; role?: 'user' | 'assistant' | 'system'; content: unknown }): SessionMessage {
  const { id = 'msg-1', role = 'assistant', content } = params;
  return {
    id,
    sessionId: 'sess-1',
    provider: 'codex-cli',
    type: role,
    contentData: JSON.stringify(content),
    providerSessionId: null,
    tokenCount: null,
    createdAt: new Date(),
  };
}

describe('parseCodexDbMessage - legacy message mapping', () => {
  it('maps legacy user message (input_text) to user Message', () => {
    const line = {
      type: 'message',
      id: 'codex-1',
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello Codex' }],
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line, role: 'user' }));
    expect(msg?.type).toBe('user');
    expect(msg && 'data' in msg ? (msg as { data: { content: string } }).data.content : '').toBe(
      'Hello Codex',
    );
  });

  it('maps legacy assistant message (output_text) to assistant Message', () => {
    const line = {
      type: 'message',
      id: 'codex-2',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hi there' }],
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as { data: { type: 'message'; data: { content: string } } }).data;
    expect(data.type).toBe('message');
    expect(data.data.content).toBe('Hi there');
  });
});

describe('parseCodexDbMessage - legacy function_call mapping', () => {
  it('maps function_call shell to assistant tool_use:bash', () => {
    const line = {
      type: 'function_call',
      id: 'f1',
      name: 'shell',
      arguments: JSON.stringify({ command: ['bash', '-lc', 'echo hello'], timeout_ms: 5000 }),
      call_id: 'call-1',
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as {
      data: { type: 'tool_use'; data: { type: 'bash'; toolId: string; data: { command: string } } };
    }).data;
    expect(data.type).toBe('tool_use');
    expect(data.data.type).toBe('bash');
    expect(data.data.data.command).toBe('bash -lc echo hello');
    expect(data.data.toolId).toBe('call-1');
  });

  it('maps function_call_output to assistant tool_result', () => {
    const line = {
      type: 'function_call_output',
      call_id: 'call-1',
      output: JSON.stringify({ stdout: 'OK', exit_code: 0 }),
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as {
      data: { type: 'tool_result'; data: { toolUseId: string; content: string; isError?: boolean } };
    }).data;
    expect(data.type).toBe('tool_result');
    expect(data.data.toolUseId).toBe('call-1');
    expect(data.data.content).toBe('OK');
    expect('isError' in data.data ? data.data.isError : false).toBe(false);
  });
});

describe('parseCodexDbMessage - COI exec mapping', () => {
  it('maps exec_command_begin to tool_use:bash with simplified command', () => {
    const line = {
      type: 'exec_command_begin',
      call_id: 'exec-1',
      command: ['bash', '-lc', 'ls -la'],
      cwd: '/repo',
      parsed_cmd: [],
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as {
      data: { type: 'tool_use'; data: { type: 'bash'; data: { command: string } } };
    }).data;
    expect(data.type).toBe('tool_use');
    expect(data.data.type).toBe('bash');
    expect(data.data.data.command).toBe('ls -la');
  });

  it('maps exec_command_end to tool_result with error flag on non-zero exit', () => {
    const line = {
      type: 'exec_command_end',
      call_id: 'exec-1',
      stdout: '',
      stderr: 'Permission denied',
      exit_code: 1,
      aggregated_output: '',
      formatted_output: '',
      duration: { secs: 0, nanos: 0 },
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as {
      data: { type: 'tool_result'; data: { toolUseId: string; content: string; isError?: boolean } };
    }).data;
    expect(data.type).toBe('tool_result');
    expect(data.data.toolUseId).toBe('exec-1');
    expect(data.data.content.length).toBeGreaterThanOrEqual(0);
    expect(data.data.isError).toBe(true);
  });
});

describe('parseCodexDbMessage - COI patch mapping', () => {
  it('maps patch_apply_begin to tool_use:edit and relativizes path', () => {
    const line = {
      type: 'patch_apply_begin',
      call_id: 'patch-1',
      auto_approved: false,
      changes: {
        '/home/user/repo/src/index.ts': { update: { unified_diff: '-a\n+b' } },
      },
    };
    const dbMsg = makeDbMessage({ content: line });
    const msg = parseCodexDbMessage(dbMsg, '/home/user/repo');
    expect(msg?.type).toBe('assistant');
    const data = (msg as {
      data: { type: 'tool_use'; data: { type: 'edit'; data: { filePath: string } } };
    }).data;
    expect(data.type).toBe('tool_use');
    expect(data.data.type).toBe('edit');
    expect(data.data.data.filePath).toBe('src/index.ts');
  });

  it('maps patch_apply_end to tool_result', () => {
    const line = {
      type: 'patch_apply_end',
      call_id: 'patch-1',
      stdout: 'ok',
      stderr: '',
      success: true,
    };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as { data: { type: 'tool_result'; data: { content: string } } }).data;
    expect(data.type).toBe('tool_result');
    expect(data.data.content).toBe('ok');
  });
});

describe('parseCodexDbMessage - COI message mapping', () => {
  it('maps agent_message to assistant message', () => {
    const line = { type: 'agent_message', message: 'Thinking…' };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as { data: { type: 'message'; data: { content: string } } }).data;
    expect(data.type).toBe('message');
    expect(data.data.content).toBe('Thinking…');
  });

  it('maps agent_reasoning to assistant message', () => {
    const line = { type: 'agent_reasoning', text: 'Reasoning text' };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as { data: { type: 'message'; data: { content: string } } }).data;
    expect(data.type).toBe('message');
    expect(data.data.content).toBe('Reasoning text');
  });

  it('maps turn_diff to assistant message', () => {
    const line = { type: 'turn_diff', unified_diff: '--- a\n+++ b' };
    const msg = parseCodexDbMessage(makeDbMessage({ content: line }));
    expect(msg?.type).toBe('assistant');
    const data = (msg as { data: { type: 'message'; data: { content: string } } }).data;
    expect(data.type).toBe('message');
    expect(data.data.content).toBe('--- a\n+++ b');
  });
});

describe('parseCodexDbMessage - ignored events', () => {
  it('returns null for non-display records', () => {
    const ignoredEvents = [
      { id: 'run1', timestamp: new Date().toISOString(), instructions: 'x', git: { commit_hash: 'h', branch: 'main', repository_url: 'u' } }, // header
      { record_type: 'state' },
      { type: 'token_count', input_tokens: 1, total_tokens: 1 },
      { type: 'exec_command_output_delta', call_id: 'c', stream: 'stdout', chunk: [97, 98] },
      { type: 'task_started', model_context_window: 200000 },
      { type: 'agent_reasoning_section_break' },
    ];
    for (const e of ignoredEvents) {
      const msg = parseCodexDbMessage(makeDbMessage({ content: e }));
      expect(msg).toBeNull();
    }
  });
});

