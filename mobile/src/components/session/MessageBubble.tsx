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
      <View className="mt-3 space-y-2">
        {toolCalls.map((toolCall, index) => (
          <View key={toolCall.id || index} className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <Text className="text-sm font-mono font-medium text-blue-700 dark:text-blue-300 mb-1">
              🔧 {toolCall.name}
            </Text>
            {toolCall.input && (
              <Text className="text-xs font-mono text-blue-600 dark:text-blue-400">
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
      <View className="mt-3 space-y-2">
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
      <View className="mt-3 bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
        <Text className="text-sm font-mono font-medium text-purple-700 dark:text-purple-300 mb-1">
          💭 Thinking
        </Text>
        <Text className="text-xs font-mono text-purple-600 dark:text-purple-400">{thinking}</Text>
      </View>
    );
  };

  // Render web search results
  const renderWebSearchResults = (webSearchResults: WebSearchResult[]) => {
    if (!webSearchResults?.length) return null;

    return (
      <View className="mt-3 space-y-2">
        <Text className="text-sm font-mono font-medium text-orange-700 dark:text-orange-300">
          🔍 Web Search Results
        </Text>
        {webSearchResults.map((result, index) => (
          <View key={index} className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
            <Text className="text-sm font-mono font-medium text-orange-700 dark:text-orange-300 mb-1">
              {result.title}
            </Text>
            <Text className="text-xs font-mono text-orange-600 dark:text-orange-400 mb-1">
              {result.url}
            </Text>
            {result.pageAge && (
              <Text className="text-xs font-mono text-orange-500 dark:text-orange-500">
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
      <View className="mt-3 bg-gray-50 dark:bg-gray-950 p-3 rounded-lg">
        <Text className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300 mb-2">
          ⚙️ System Info
        </Text>
        <View className="space-y-1">
          {metadata.cwd && (
            <Text className="text-xs font-mono text-gray-600 dark:text-gray-400">
              Directory: {metadata.cwd}
            </Text>
          )}
          {metadata.model && (
            <Text className="text-xs font-mono text-gray-600 dark:text-gray-400">
              Model: {metadata.model}
            </Text>
          )}
          {metadata.tools && metadata.tools.length > 0 && (
            <Text className="text-xs font-mono text-gray-600 dark:text-gray-400">
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
      <View className="mt-3 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
        <Text className="text-sm font-mono font-medium text-blue-700 dark:text-blue-300 mb-2">
          📊 Result Summary
        </Text>
        <View className="space-y-1">
          <Text className="text-xs font-mono text-blue-600 dark:text-blue-400">
            Status: {metadata.subtype}
          </Text>
          {metadata.durationMs && (
            <Text className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Duration: {metadata.durationMs}ms
            </Text>
          )}
          {metadata.numTurns && (
            <Text className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Turns: {metadata.numTurns}
            </Text>
          )}
          {metadata.totalCostUsd && (
            <Text className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Cost: ${metadata.totalCostUsd.toFixed(4)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Pressable 
      onPress={handlePress}
      onLongPress={handleLongPress} 
      className="mb-6"
      style={({ pressed }) => [
        { opacity: pressed ? 0.8 : 1 }
      ]}
    >
      <Text className="text-sm font-mono font-medium mb-2 text-foreground">
        {getRoleDisplayName()}
      </Text>

      <View>
        {message.content.trim() ? (
          <MarkdownRenderer content={message.content} citations={message.citations} />
        ) : (
          <Text className="text-muted-foreground italic font-mono">[No content]</Text>
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
        <View className="mt-3 bg-gray-50 dark:bg-gray-950 p-2 rounded">
          <Text className="text-xs font-mono text-gray-600 dark:text-gray-400">
            Tokens: {message.usage.inputTokens}↑ {message.usage.outputTokens}↓
            {message.usage.serviceTier && ` • ${String(message.usage.serviceTier)}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
};
