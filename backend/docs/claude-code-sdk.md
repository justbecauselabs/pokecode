Claude Code TypeScript SDK — Message Types

- Purpose: Reference the message, content block, and streaming event types defined in `src/resources/messages/messages.ts`.
- Scope: What you can receive and produce in the Messages API, focusing on types and their key fields.

**Message Object**
- `id`: Unique identifier.
- `type`: Always `message`.
- `role`: Always `assistant` for responses.
- `model`: The `Model` string used.
- `content`: Array of `ContentBlock` (see below).
- `stop_reason`: `end_turn | max_tokens | stop_sequence | tool_use | pause_turn | refusal`.
- `stop_sequence`: Populated when a custom stop sequence matches.
- `usage`: `Usage` accounting (`input_tokens`, `output_tokens`, cache fields, `server_tool_use`, `service_tier`).

**Streaming Events**
- `message_start`: Carries the initial `message` shell.
- `content_block_start`: Starts a block; includes `index` and the block (e.g., `text`, `tool_use`).
- `content_block_delta`: Incremental delta for the active block at `index`.
- `content_block_stop`: End of the current block at `index`.
- `message_delta`: Message‑level updates; includes `usage` and may include `stop_reason`/`stop_sequence`.
- `message_stop`: Final event signaling completion.

**Deltas (content_block_delta payloads)**
- `text_delta`: `{ type: 'text_delta', text }`.
- `thinking_delta`: `{ type: 'thinking_delta', thinking }`.
- `citations_delta`: `{ type: 'citations_delta', citation }` with citation location types (see Citations).
- `input_json_delta`: `{ type: 'input_json_delta', partial_json }`.
- `signature_delta`: `{ type: 'signature_delta', signature }`.

**Content Blocks (assistant output)**
- `text`: `{ type: 'text', text, citations? }` where `citations` may include multiple location kinds.
- `thinking`: `{ type: 'thinking', thinking, signature }` when extended thinking is enabled.
- `redacted_thinking`: `{ type: 'redacted_thinking', data }` indicating hidden reasoning.
- `tool_use`: `{ type: 'tool_use', id, name, input }` for client tools.
- `server_tool_use`: `{ type: 'server_tool_use', id, name: 'web_search', input }` for server tools managed by Anthropic.
- `web_search_tool_result`: `{ type: 'web_search_tool_result', tool_use_id, content }` where `content` is either an error or an array of `web_search_result` items.

**User/Input Content Blocks**
- `text`: `{ type: 'text', text, citations? }`.
- `image`: `{ type: 'image', source }` where `source` is `base64` or `url` with supported media types.
- `document`: `{ type: 'document', source, title?, context?, citations?, cache_control? }` for PDF, plain text, URL PDF, or composed content.
- `search_result`: `{ type: 'search_result', title, source, content, citations?, cache_control? }`.
- `tool_result`: `{ type: 'tool_result', tool_use_id, content?, is_error?, cache_control? }` returning outputs for a prior `tool_use`.
- `web_search_tool_result` (param): `{ type: 'web_search_tool_result', tool_use_id, content, cache_control? }` where `content` is an array of `web_search_result` params or a `web_search_tool_result_error`.

**Citations**
- Text citations on `text` blocks can include:
- `char_location`: `{ type: 'char_location', cited_text, start_char_index, end_char_index, document_index, document_title?, file_id? }`.
- `page_location`: `{ type: 'page_location', cited_text, start_page_number, end_page_number, document_index, document_title?, file_id? }`.
- `content_block_location`: `{ type: 'content_block_location', cited_text, start_block_index, end_block_index, document_index, document_title?, file_id? }`.
- `search_result_location`: `{ type: 'search_result_location', cited_text, source, start_block_index, end_block_index, search_result_index, title? }`.
- `web_search_result_location`: `{ type: 'web_search_result_location', cited_text, url, encrypted_index, title? }`.

**Web Search Types**
- `web_search_result`: `{ type: 'web_search_result', url, title, encrypted_content, page_age? }`.
- `web_search_tool_result_error`: `{ type: 'web_search_tool_result_error', error_code }` where `error_code` is one of `invalid_tool_input | unavailable | max_uses_exceeded | too_many_requests | query_too_long`.

**Tools (type definitions referenced by messages)**
- `tool`: `{ name, description?, input_schema, type?: 'custom' }` generic client tool definition.
- `bash_20250124`: `{ type: 'bash_20250124', name: 'bash' }`.
- `text_editor_20250124 | 20250429 | 20250728`: `{ type, name: 'str_replace_editor' | 'str_replace_based_edit_tool', max_characters? }`.
- `web_search_20250305`: `{ type: 'web_search_20250305', name: 'web_search', allowed_domains?, blocked_domains?, max_uses?, user_location?, cache_control? }`.
- `tool_choice`: `auto | any | tool | none` with optional `disable_parallel_tool_use` on `auto | any | tool`.

**Thinking Configuration**
- `thinking`: `ThinkingConfigParam` controls extended thinking output.
- `enabled`: `{ type: 'enabled', budget_tokens }` where `budget_tokens >= 1024` and `< max_tokens`.
- `disabled`: `{ type: 'disabled' }`.

**Stop Reasons**
- `StopReason`: `end_turn | max_tokens | stop_sequence | tool_use | pause_turn | refusal`.

**Event Type Aliases**
- `MessageStreamEvent`: Union of all raw stream events.
- `MessageStartEvent`, `MessageDeltaEvent`, `MessageStopEvent`: Aliases of raw counterparts.
- `ContentBlockStartEvent`, `ContentBlockDeltaEvent`, `ContentBlockStopEvent`: Aliases of raw counterparts.

Notes
- Reconstruct streamed content by grouping on `index` and concatenating deltas for each content block.
- When `stop_reason` is `tool_use`, expect to send `tool_result` content referencing the emitted `tool_use.id` to continue.

Reference
- Source of truth: `src/resources/messages/messages.ts` in `anthropics/anthropic-sdk-typescript`.
