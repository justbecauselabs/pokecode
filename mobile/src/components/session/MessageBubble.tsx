import type React from 'react';
import { Text, Pressable, View } from 'react-native';
import type { Message } from '../../types/messages';
import { extractMessageText, getMessageRole } from '../../types/messages';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  onLongPress?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onLongPress }) => {
  // Guard clause to handle undefined messages
  if (!message || !message.data) {
    console.warn('MessageBubble received undefined message or message.data');
    return (
      <View className="m-2 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
        <Text className="text-red-600 dark:text-red-400 italic">
          [Error: Invalid message data]
        </Text>
      </View>
    );
  }

  const handleLongPress = () => {
    console.log('MessageBubble onLongPress called for message:', message.id);
    onLongPress?.();
  };

  const handlePress = () => {
    console.log('MessageBubble onPress called for message:', message.id);
  };
  
  const role = getMessageRole(message);
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const isAssistant = role === 'assistant';
  const isResult = role === 'result';
  const sdkMessage = message.data as any;

  // Render tool calls from assistant messages
  const renderToolCalls = () => {
    if (!isAssistant || !sdkMessage.message?.content) return null;
    
    const toolUseBlocks = sdkMessage.message.content.filter((block: any) => block.type === 'tool_use');
    if (toolUseBlocks.length === 0) return null;

    return (
      <View className="mt-2">
        {toolUseBlocks.map((toolCall: any, index: number) => (
          <View key={toolCall.id || index} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mb-2">
            <Text className="text-sm font-mono font-medium text-blue-700 dark:text-blue-300 mb-1">
              🔧 Tool: {toolCall.name}
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
                })()}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render tool results from user messages  
  const renderToolResults = () => {
    if (!isUser || !sdkMessage.message?.content || !Array.isArray(sdkMessage.message.content)) return null;
    
    const toolResultBlocks = sdkMessage.message.content.filter((block: any) => block.type === 'tool_result');
    if (toolResultBlocks.length === 0) return null;

    return (
      <View className="mt-2">
        {toolResultBlocks.map((result: any, index: number) => (
          <View
            key={result.tool_use_id || index}
            className={`p-3 rounded-lg mb-2 ${
              result.is_error ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'
            }`}
          >
            <Text
              className={`text-sm font-mono font-medium mb-1 ${
                result.is_error
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-green-700 dark:text-green-300'
              }`}
            >
              {result.is_error ? '❌ Tool Error' : '✅ Tool Result'}
            </Text>
            <Text
              className={`text-xs font-mono ${
                result.is_error
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

  // Render thinking content from assistant messages
  const renderThinking = () => {
    if (!isAssistant || !sdkMessage.message?.content) return null;
    
    const thinkingBlocks = sdkMessage.message.content.filter((block: any) => 
      block.type === 'thinking' || block.type === 'redacted_thinking'
    );
    if (thinkingBlocks.length === 0) return null;

    return (
      <View className="mt-2">
        {thinkingBlocks.map((block: any, index: number) => (
          <View key={index} className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg mb-2">
            <Text className="text-sm font-mono font-medium text-purple-700 dark:text-purple-300 mb-1">
              🤔 {block.type === 'redacted_thinking' ? 'Thinking (Redacted)' : 'Thinking'}
            </Text>
            <Text className="text-xs font-mono text-purple-600 dark:text-purple-400">
              {block.type === 'redacted_thinking' 
                ? '[Thinking content redacted]' 
                : (block.thinking || block.data || '[No thinking content]')
              }
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Render web search results from assistant messages
  const renderWebSearchResults = () => {
    if (!isAssistant || !sdkMessage.message?.content) return null;
    
    const webSearchBlocks = sdkMessage.message.content.filter((block: any) => 
      block.type === 'web_search_tool_result'
    );
    if (webSearchBlocks.length === 0) return null;

    return (
      <View className="mt-2">
        {webSearchBlocks.map((block: any, index: number) => (
          <View key={index} className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg mb-2">
            <Text className="text-sm font-mono font-medium text-orange-700 dark:text-orange-300 mb-2">
              🔍 Web Search Results
            </Text>
            {Array.isArray(block.content) && block.content.map((result: any, resultIndex: number) => (
              <View key={resultIndex} className="mb-2 p-2 bg-white dark:bg-gray-800 rounded">
                <Text className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                  {result.title || 'Untitled'}
                </Text>
                <Text className="text-xs text-orange-600 dark:text-orange-400 mb-1">
                  {result.url}
                </Text>
                {result.page_age && (
                  <Text className="text-xs text-orange-500 dark:text-orange-500">
                    Age: {result.page_age}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  // Render system metadata
  const renderSystemMetadata = () => {
    if (!isSystem) return null;

    return (
      <View className="mt-2 p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
        <Text className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300 mb-2">
          ⚙️ System Info
        </Text>
        <View className="space-y-1">
          {sdkMessage.cwd && (
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              Directory: {sdkMessage.cwd}
            </Text>
          )}
          {sdkMessage.model && (
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              Model: {sdkMessage.model}
            </Text>
          )}
          {sdkMessage.tools && sdkMessage.tools.length > 0 && (
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              Tools: {sdkMessage.tools.slice(0, 5).join(', ')}{sdkMessage.tools.length > 5 ? `... (+${sdkMessage.tools.length - 5} more)` : ''}
            </Text>
          )}
          {sdkMessage.apiKeySource && (
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              API Key: {sdkMessage.apiKeySource}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render result metadata
  const renderResultMetadata = () => {
    if (!isResult) return null;

    return (
      <View className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
        <Text className="text-sm font-mono font-medium text-emerald-700 dark:text-emerald-300 mb-2">
          📊 Result Summary
        </Text>
        <View className="space-y-1">
          <Text className="text-xs text-emerald-600 dark:text-emerald-400">
            Status: {sdkMessage.subtype || 'completed'}
          </Text>
          {sdkMessage.duration_ms && (
            <Text className="text-xs text-emerald-600 dark:text-emerald-400">
              Duration: {sdkMessage.duration_ms}ms
            </Text>
          )}
          {sdkMessage.num_turns && (
            <Text className="text-xs text-emerald-600 dark:text-emerald-400">
              Turns: {sdkMessage.num_turns}
            </Text>
          )}
          {sdkMessage.total_cost_usd && (
            <Text className="text-xs text-emerald-600 dark:text-emerald-400">
              Cost: ${sdkMessage.total_cost_usd.toFixed(4)}
            </Text>
          )}
          {sdkMessage.is_error !== undefined && (
            <Text className={`text-xs ${sdkMessage.is_error ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {sdkMessage.is_error ? '❌ Error' : '✅ Success'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const messageText = extractMessageText(message);

  return (
    <Pressable 
      onPress={handlePress} 
      onLongPress={handleLongPress}
      className={`m-2 p-3 rounded-lg ${
        isUser 
          ? 'bg-blue-500 ml-12 self-end' 
          : isSystem 
          ? 'bg-gray-200 dark:bg-gray-800' 
          : isResult
          ? 'bg-emerald-100 dark:bg-emerald-900'
          : 'bg-gray-100 dark:bg-gray-900 mr-12'
      }`}
    >
      {/* Main message content */}
      <View className={isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>
        {messageText.trim() ? (
          <MarkdownRenderer 
            content={messageText} 
            citations={isAssistant ? (sdkMessage.message?.content || [])
              .filter((block: any) => block.type === 'text' && block.citations)
              .flatMap((block: any) => block.citations || []) : []} 
          />
        ) : (
          <Text className={`italic ${isUser ? 'text-white' : 'text-gray-500'}`}>
            [No content]
          </Text>
        )}
      </View>

      {/* Render thinking content */}
      {renderThinking()}

      {/* Render tool calls */}
      {renderToolCalls()}

      {/* Render tool results */}
      {renderToolResults()}

      {/* Render web search results */}
      {renderWebSearchResults()}

      {/* Render system metadata */}
      {renderSystemMetadata()}

      {/* Render result metadata */}
      {renderResultMetadata()}

      {/* Usage information for assistant messages */}
      {isAssistant && sdkMessage.message?.usage && (
        <View className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          <Text className="text-xs text-gray-600 dark:text-gray-400">
            Tokens: {sdkMessage.message.usage.input_tokens}↑ {sdkMessage.message.usage.output_tokens}↓
            {sdkMessage.message.usage.service_tier && ` • ${sdkMessage.message.usage.service_tier}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
};
