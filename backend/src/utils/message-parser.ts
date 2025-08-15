import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-code';
import type {
  ContentBlock,
  ContentBlockParam,
  RedactedThinkingBlock,
  TextBlock,
  TextCitation,
  ThinkingBlock,
  ToolResultBlockParam,
  ToolUseBlock,
  WebSearchResultBlock,
  WebSearchToolResultBlock,
} from '@anthropic-ai/sdk/resources/messages';
import type { Static } from '@sinclair/typebox';
import type { ApiMessage, CitationSchema, WebSearchResultSchema } from '../schemas/message.schema';
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
 * Convert SDK message to API format with comprehensive content extraction
 */
export function sdkToApiMessage(
  sdkMessage: SDKMessage,
  dbMessageId: string,
  sessionId: string,
  timestamp: Date,
): ApiMessage | null {
  try {
    // Determine message type and role
    let role: 'user' | 'assistant' | 'system' = 'assistant';
    if (sdkMessage.type === 'user') {
      role = 'user';
    } else if (sdkMessage.type === 'system') {
      role = 'system';
    }

    // Initialize all possible content fields
    let content = '';
    let toolCalls: Array<{ id?: string; name: string; input: unknown; result?: { content: string; isError?: boolean } }> | undefined;
    let thinking: string | undefined;
    let citations: Array<{ type: string; citedText: string; [key: string]: unknown }> | undefined;
    let webSearchResults:
      | Array<{
          type: string;
          url: string;
          title: string;
          encryptedContent: string;
          pageAge?: string;
        }>
      | undefined;

    // Handle different message types
    if (sdkMessage.type === 'user') {
      const userContent = extractUserContent(sdkMessage as SDKUserMessage);
      content = userContent.content;
      // Extract tool results directly into tool calls format
      if (userContent.toolResults) {
        toolCalls = userContent.toolResults.map(r => ({
          id: r.toolUseId,
          name: 'tool_result',
          input: {},
          result: {
            content: r.content,
            ...(r.isError !== undefined && { isError: r.isError }),
          },
        }));
      }
    } else if (sdkMessage.type === 'assistant') {
      const extracted = extractAssistantContent(sdkMessage as SDKAssistantMessage);
      content = extracted.content;
      toolCalls = extracted.toolCalls;
      thinking = extracted.thinking;
      citations = extracted.citations;
      webSearchResults = extracted.webSearchResults;
    } else if (sdkMessage.type === 'system') {
      const systemMsg = sdkMessage as SDKSystemMessage;
      content = `[System: ${systemMsg.subtype}]`;
    } else if (sdkMessage.type === 'result') {
      const resultMsg = sdkMessage as SDKResultMessage;
      content =
        resultMsg.subtype === 'success'
          ? 'result' in resultMsg
            ? resultMsg.result || '[Result completed]'
            : '[Result completed]'
          : `[Error: ${resultMsg.subtype}]`;
    }

    // Build base message
    const apiMessage: ApiMessage = {
      id: dbMessageId,
      sessionId,
      role,
      content: content || '[No content]',
      timestamp: timestamp.toISOString(),
      messageType: sdkMessage.type,
      claudeSessionId: sdkMessage.session_id,
      parentToolUseId: 'parent_tool_use_id' in sdkMessage ? sdkMessage.parent_tool_use_id : null,
    };

    // Add optional fields if they exist
    if (toolCalls?.length) {
      apiMessage.toolCalls = toolCalls;
    }
    if (thinking) apiMessage.thinking = thinking;
    if (citations?.length) apiMessage.citations = citations as Static<typeof CitationSchema>[];
    if (webSearchResults?.length)
      apiMessage.webSearchResults = webSearchResults as Static<typeof WebSearchResultSchema>[];

    // Add message-specific metadata
    if (sdkMessage.type === 'assistant') {
      const assistantMsg = sdkMessage as SDKAssistantMessage;
      if (assistantMsg.message) {
        apiMessage.model = assistantMsg.message.model;
        apiMessage.stopReason = assistantMsg.message.stop_reason;
        apiMessage.stopSequence = assistantMsg.message.stop_sequence;
        if (assistantMsg.message.usage) {
          const usage = assistantMsg.message.usage;
          apiMessage.usage = {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            ...(usage.cache_creation_input_tokens !== null &&
              usage.cache_creation_input_tokens !== undefined && {
                cacheCreationInputTokens: usage.cache_creation_input_tokens,
              }),
            ...(usage.cache_read_input_tokens !== null &&
              usage.cache_read_input_tokens !== undefined && {
                cacheReadInputTokens: usage.cache_read_input_tokens,
              }),
            ...(usage.service_tier !== undefined && { serviceTier: usage.service_tier }),
          };
        }
      }
    }

    if (sdkMessage.type === 'system') {
      const systemMsg = sdkMessage as SDKSystemMessage;
      apiMessage.systemMetadata = {
        cwd: systemMsg.cwd,
        tools: systemMsg.tools,
        mcpServers: systemMsg.mcp_servers,
        model: systemMsg.model,
        permissionMode: systemMsg.permissionMode,
        slashCommands: systemMsg.slash_commands,
        apiKeySource: systemMsg.apiKeySource,
      };
    }

    if (sdkMessage.type === 'result') {
      const resultMsg = sdkMessage as SDKResultMessage;
      apiMessage.resultMetadata = {
        subtype: resultMsg.subtype,
        durationMs: resultMsg.duration_ms,
        durationApiMs: resultMsg.duration_api_ms,
        isError: resultMsg.is_error,
        numTurns: resultMsg.num_turns,
        ...('result' in resultMsg &&
          resultMsg.result !== undefined && { result: resultMsg.result }),
        totalCostUsd: resultMsg.total_cost_usd,
        ...(resultMsg.usage && {
          usage: {
            inputTokens: resultMsg.usage.input_tokens,
            outputTokens: resultMsg.usage.output_tokens,
            ...(resultMsg.usage.cache_creation_input_tokens !== null && {
              cacheCreationInputTokens: resultMsg.usage.cache_creation_input_tokens,
            }),
            ...(resultMsg.usage.cache_read_input_tokens !== null && {
              cacheReadInputTokens: resultMsg.usage.cache_read_input_tokens,
            }),
            ...(resultMsg.usage.service_tier !== undefined && {
              serviceTier: resultMsg.usage.service_tier,
            }),
          },
        }),
      };
    }

    return apiMessage;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageType: sdkMessage.type,
      },
      'Failed to convert SDK message to API format',
    );
    return null;
  }
}

/**
 * Extract content from user messages
 */
function extractUserContent(sdkMessage: SDKUserMessage): {
  content: string;
  toolResults?: Array<{ toolUseId: string; content: string; isError?: boolean }>;
} {
  // Handle different user message formats
  if ('text' in sdkMessage.message && typeof sdkMessage.message.text === 'string') {
    return { content: sdkMessage.message.text };
  }

  if (sdkMessage.message.content) {
    if (typeof sdkMessage.message.content === 'string') {
      return { content: sdkMessage.message.content };
    }

    if (Array.isArray(sdkMessage.message.content)) {
      // Extract text parts
      const textParts = sdkMessage.message.content
        .filter((c: ContentBlockParam): c is TextBlock => c.type === 'text')
        .map((c: TextBlock) => c.text)
        .filter(Boolean);

      // Extract tool results
      const toolResultBlocks = sdkMessage.message.content.filter(
        (c: ContentBlockParam): c is ToolResultBlockParam => c.type === 'tool_result',
      );

      const results = toolResultBlocks.map((c: ToolResultBlockParam) => ({
        toolUseId: c.tool_use_id,
        content: Array.isArray(c.content)
          ? c.content
              .map((item: unknown) =>
                typeof item === 'object' &&
                item !== null &&
                'type' in item &&
                item.type === 'text' &&
                'text' in item
                  ? (item as { text: string }).text
                  : JSON.stringify(item),
              )
              .join('\n')
          : c.content || '',
        ...(c.is_error !== undefined && { isError: c.is_error }),
      }));

      return {
        content: textParts.join('\n'),
        ...(results.length > 0 && { toolResults: results }),
      };
    }
  }

  return { content: '' };
}

/**
 * Extract content from assistant messages
 */
function extractAssistantContent(sdkMessage: SDKAssistantMessage): {
  content: string;
  toolCalls?: Array<{ id?: string; name: string; input: unknown; result?: { content: string; isError?: boolean } }>;
  thinking?: string;
  citations?: Array<{ type: string; citedText: string; [key: string]: unknown }>;
  webSearchResults?: Array<{
    type: string;
    url: string;
    title: string;
    encryptedContent: string;
    pageAge?: string;
  }>;
} {
  if (!Array.isArray(sdkMessage.message?.content)) {
    return { content: '' };
  }

  const contentBlocks = sdkMessage.message.content;
  const result: {
    content: string;
    toolCalls?: Array<{ id?: string; name: string; input: unknown; result?: { content: string; isError?: boolean } }>;
    thinking?: string;
    citations?: Array<{ type: string; citedText: string; [key: string]: unknown }>;
    webSearchResults?: Array<{
      type: string;
      url: string;
      title: string;
      encryptedContent: string;
      pageAge?: string;
    }>;
  } = { content: '' };

  // Extract text content with citations
  const textBlocks = contentBlocks.filter((c: ContentBlock): c is TextBlock => c.type === 'text');
  const textParts = textBlocks.map((c: TextBlock) => c.text).filter(Boolean);
  result.content = textParts.join('\n');

  // Extract citations from text blocks
  const allCitations = textBlocks
    .map((c: TextBlock) => c.citations)
    .filter((citations): citations is TextCitation[] => Boolean(citations))
    .flat()
    .map((citation: TextCitation) => ({
      type: citation.type,
      citedText: citation.cited_text,
      documentIndex: 'document_index' in citation ? citation.document_index : undefined,
      documentTitle: 'document_title' in citation ? citation.document_title : undefined,
      fileId: 'file_id' in citation ? citation.file_id : undefined,
      startCharIndex: 'start_char_index' in citation ? citation.start_char_index : undefined,
      endCharIndex: 'end_char_index' in citation ? citation.end_char_index : undefined,
      startPageNumber: 'start_page_number' in citation ? citation.start_page_number : undefined,
      endPageNumber: 'end_page_number' in citation ? citation.end_page_number : undefined,
      startBlockIndex: 'start_block_index' in citation ? citation.start_block_index : undefined,
      endBlockIndex: 'end_block_index' in citation ? citation.end_block_index : undefined,
      url: 'url' in citation ? citation.url : undefined,
      encryptedIndex: 'encrypted_index' in citation ? citation.encrypted_index : undefined,
      searchResultIndex:
        'search_result_index' in citation ? citation.search_result_index : undefined,
      source: 'source' in citation ? citation.source : undefined,
      title: 'title' in citation ? citation.title : undefined,
    }));
  if (allCitations.length > 0) {
    result.citations = allCitations;
  }

  // Extract tool calls (both regular and server tools)
  const toolUseBlocks = contentBlocks.filter(
    (c: ContentBlock): c is ToolUseBlock => c.type === 'tool_use',
  );
  if (toolUseBlocks.length > 0) {
    result.toolCalls = toolUseBlocks.map((c: ToolUseBlock) => ({
      id: c.id,
      name: c.name,
      input: c.input,
    }));
  }

  // Extract thinking content
  const thinkingBlocks = contentBlocks.filter(
    (c: ContentBlock): c is ThinkingBlock | RedactedThinkingBlock =>
      c.type === 'thinking' || c.type === 'redacted_thinking',
  );
  if (thinkingBlocks.length > 0) {
    const thinkingParts = thinkingBlocks
      .map((c: ThinkingBlock | RedactedThinkingBlock) =>
        c.type === 'thinking' ? c.thinking : c.data,
      )
      .filter(Boolean);
    if (thinkingParts.length > 0) {
      result.thinking = thinkingParts.join('\n');
    }
  }

  // Extract web search results
  const webSearchBlocks = contentBlocks.filter(
    (c: ContentBlock): c is WebSearchToolResultBlock => c.type === 'web_search_tool_result',
  );
  if (webSearchBlocks.length > 0) {
    const searchResults = webSearchBlocks
      .map((c: WebSearchToolResultBlock) => c.content)
      .filter((content: unknown): content is Array<WebSearchResultBlock> => Array.isArray(content))
      .flat()
      .filter(
        (item: unknown): item is WebSearchResultBlock =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          item.type === 'web_search_result',
      )
      .map((item: WebSearchResultBlock) => ({
        type: item.type,
        url: item.url,
        title: item.title,
        encryptedContent: item.encrypted_content,
        ...(item.page_age && { pageAge: item.page_age }),
      }));

    if (searchResults.length > 0) {
      result.webSearchResults = searchResults;
    }
  }

  return result;
}
