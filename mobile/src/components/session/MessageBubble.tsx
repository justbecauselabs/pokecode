import type React from 'react';
import { Text, Pressable, View } from 'react-native';
import type { Message, ToolCall, ToolResult, WebSearchResult } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  onLongPress?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onLongPress }) => {
  const handleLongPress = () => {
    console.log('MessageBubble onLongPress called for message:', message.id);
    onLongPress?.();
  };

  const handlePress = () => {
    console.log('MessageBubble onPress called for message:', message.id);
  };
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isResult = message.messageType === 'result';

  // Get role display name
  const getRoleDisplayName = () => {
    if (isUser) return 'User';
    if (isSystem) return 'System';
    if (isResult) return 'Result';
    return 'Assistant';
  };

  // Render tool calls
  const renderToolCalls = (toolCalls: ToolCall[]) => {
    if (!toolCalls?.length) return null;

    return (
      <View>
        {toolCalls.map((toolCall, index) => (
          <View key={toolCall.id || index}>
            <Text>
              Tool: {toolCall.name}
            </Text>
            {toolCall.input && (
              <Text>
                {(() => {
                  if (typeof toolCall.input === 'string') {
                    return toolCall.input;
                  }
                  try {
                    return JSON.stringify(toolCall.input, null, 2);
                  } catch {
                    return String(toolCall.input);
                  }
                })() as string}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render tool results
  const renderToolResults = (toolResults: ToolResult[]) => {
    if (!toolResults?.length) return null;

    return (
      <View>
        {toolResults.map((result, index) => (
          <View
            key={result.toolUseId || index}
            className={`p-3 rounded-lg ${
              result.isError ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'
            }`}
          >
            <Text
              className={`text-sm font-mono font-medium mb-1 ${
                result.isError
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-green-700 dark:text-green-300'
              }`}
            >
              {result.isError ? '❌ Tool Error' : '✅ Tool Result'}
            </Text>
            <Text
              className={`text-xs font-mono ${
                result.isError
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {result.content}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Render thinking content
  const renderThinking = (thinking: string) => {
    if (!thinking?.trim()) return null;

    return (
      <View>
        <Text>
          Thinking
        </Text>
        <Text>
          {thinking}
        </Text>
      </View>
    );
  };

  // Render web search results
  const renderWebSearchResults = (webSearchResults: WebSearchResult[]) => {
    if (!webSearchResults?.length) return null;

    return (
      <View>
        <Text>
          Web Search Results
        </Text>
        {webSearchResults.map((result, index) => (
          <View key={index}>
            <Text>
              {result.title}
            </Text>
            <Text>
              {result.url}
            </Text>
            {result.pageAge && (
              <Text>
                Age: {result.pageAge}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render system metadata
  const renderSystemMetadata = () => {
    if (!isSystem || !message.systemMetadata) return null;

    const metadata = message.systemMetadata;
    return (
      <View>
        <Text>
          System Info
        </Text>
        <View>
          {metadata.cwd && (
            <Text>
              Directory: {metadata.cwd}
            </Text>
          )}
          {metadata.model && (
            <Text>
              Model: {metadata.model}
            </Text>
          )}
          {metadata.tools && metadata.tools.length > 0 && (
            <Text>
              Tools: {metadata.tools.join(', ')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render result metadata
  const renderResultMetadata = () => {
    if (!isResult || !message.resultMetadata) return null;

    const metadata = message.resultMetadata;
    return (
      <View>
        <Text>
          Result Summary
        </Text>
        <View>
          <Text>
            Status: {metadata.subtype}
          </Text>
          {metadata.durationMs && (
            <Text>
              Duration: {metadata.durationMs}ms
            </Text>
          )}
          {metadata.numTurns && (
            <Text>
              Turns: {metadata.numTurns}
            </Text>
          )}
          {metadata.totalCostUsd && (
            <Text>
              Cost: ${metadata.totalCostUsd.toFixed(4)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View>
      <Text>
        {getRoleDisplayName()}
      </Text>

      <View>
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} citations={message.citations} />
        ) : (
          <Text>[No content]</Text>
        )}
      </View>

      {/* Render thinking content */}
      {message.thinking && renderThinking(message.thinking)}

      {/* Render tool calls */}
      {message.toolCalls && renderToolCalls(message.toolCalls)}

      {/* Render tool results */}
      {message.toolResults && renderToolResults(message.toolResults)}

      {/* Render web search results */}
      {message.webSearchResults && renderWebSearchResults(message.webSearchResults)}

      {/* Render system metadata */}
      {renderSystemMetadata()}

      {/* Render result metadata */}
      {renderResultMetadata()}

      {/* Usage information for assistant messages */}
      {message.usage && !isUser && !isSystem && (
        <View>
          <Text>
            Tokens: {message.usage.inputTokens}↑ {message.usage.outputTokens}↓
            {message.usage.serviceTier && ` • ${String(message.usage.serviceTier)}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
};
