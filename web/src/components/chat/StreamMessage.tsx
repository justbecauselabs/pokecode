import {
	AlertCircle,
	Brain,
	CheckCircle,
	ChevronRight,
	Clock,
	Globe,
	Link,
	MessageCircle,
	Pause,
	Play,
	Server,
	Settings,
	Square,
	Zap,
} from "lucide-react";
import type {
	StreamMessage as StreamMessageType,
	TodoList,
	WebSearchResult,
	WebSearchToolResultError,
} from "../../types/chat";
import { Badge } from "../ui/Badge";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { CodeBlock } from "../ui/CodeBlock";
import { ThinkingDisplay } from "./ThinkingDisplay";
import { TodoListDisplay } from "./TodoListDisplay";
import { WebSearchDisplay } from "./WebSearchDisplay";

interface StreamMessageProps {
	message: StreamMessageType;
}

export function StreamMessage({ message }: StreamMessageProps) {
	// Validate message object
	if (!message || typeof message.type !== "string") {
		console.warn("Invalid message passed to StreamMessage:", message);
		return (
			<Card className="border-red-200 bg-red-50">
				<CardContent className="p-2">
					<div className="text-xs text-red-600">Invalid message object</div>
				</CardContent>
			</Card>
		);
	}

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "connected":
				return <Link className="h-4 w-4" />;
			case "message_start":
				return <Play className="h-4 w-4" />;
			case "content_block_start":
				return <ChevronRight className="h-4 w-4" />;
			case "text_delta":
				return <MessageCircle className="h-4 w-4" />;
			case "thinking_delta":
				return <Brain className="h-4 w-4" />;
			case "citations_delta":
				return <Link className="h-4 w-4" />;
			case "content_block_delta":
				return <Zap className="h-4 w-4" />;
			case "content_block_stop":
				return <Square className="h-4 w-4" />;
			case "message_delta":
				return <Pause className="h-4 w-4" />;
			case "message_stop":
				return <Square className="h-4 w-4" />;
			case "message":
				return <MessageCircle className="h-4 w-4" />;
			case "thinking":
				return <Brain className="h-4 w-4" />;
			case "tool_use":
				return <Settings className="h-4 w-4" />;
			case "server_tool_use":
				return <Server className="h-4 w-4" />;
			case "tool_result":
				return <CheckCircle className="h-4 w-4" />;
			case "web_search_result":
				return <Globe className="h-4 w-4" />;
			case "complete":
				return <CheckCircle className="h-4 w-4" />;
			case "error":
				return <AlertCircle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	const getTypeColor = (type: string) => {
		switch (type) {
			case "connected":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "message_start":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "content_block_start":
				return "bg-indigo-100 text-indigo-800 border-indigo-200";
			case "text_delta":
				return "bg-green-100 text-green-800 border-green-200";
			case "thinking_delta":
				return "bg-purple-100 text-purple-800 border-purple-200";
			case "citations_delta":
				return "bg-amber-100 text-amber-800 border-amber-200";
			case "content_block_delta":
				return "bg-cyan-100 text-cyan-800 border-cyan-200";
			case "content_block_stop":
				return "bg-gray-100 text-gray-800 border-gray-200";
			case "message_delta":
				return "bg-slate-100 text-slate-800 border-slate-200";
			case "message_stop":
				return "bg-gray-100 text-gray-800 border-gray-200";
			case "message":
				return "bg-green-100 text-green-800 border-green-200";
			case "thinking":
				return "bg-purple-100 text-purple-800 border-purple-200";
			case "tool_use":
				return "bg-orange-100 text-orange-800 border-orange-200";
			case "server_tool_use":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "tool_result":
				return "bg-purple-100 text-purple-800 border-purple-200";
			case "web_search_result":
				return "bg-green-100 text-green-800 border-green-200";
			case "complete":
				return "bg-emerald-100 text-emerald-800 border-emerald-200";
			case "error":
				return "bg-red-100 text-red-800 border-red-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const formatTime = (timestamp: string) => {
		return new Date(timestamp).toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const renderContent = () => {
		// Additional safety check
		if (!message || !message.type) {
			return (
				<div className="text-sm text-muted-foreground">
					Invalid message data
				</div>
			);
		}

		switch (message.type) {
			case "connected": {
				const connectData = message.data as
					| { promptId?: string; messageId?: string }
					| undefined;
				return (
					<div className="text-sm text-muted-foreground">
						Connected to stream{" "}
						{connectData?.promptId && `(${connectData.promptId})`}
						{connectData?.messageId && (
							<div className="text-xs font-mono mt-1">
								Message ID: {connectData.messageId}
							</div>
						)}
					</div>
				);
			}

			case "message_start": {
				const startData = message.data as
					| { messageId?: string; model?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-blue-600">
							Message Started
						</div>
						{startData && (
							<div className="text-sm text-muted-foreground">
								{startData.model && <div>Model: {startData.model}</div>}
								{startData.messageId && (
									<div className="text-xs font-mono">
										ID: {startData.messageId}
									</div>
								)}
							</div>
						)}
					</div>
				);
			}

			case "content_block_start": {
				const blockStartData = message.data as
					| { index?: number; contentBlock?: any }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium">Content Block Started</div>
						{blockStartData && (
							<div className="text-sm text-muted-foreground">
								<div>Block #{blockStartData.index}</div>
								{blockStartData.contentBlock && (
									<div>Type: {blockStartData.contentBlock.type}</div>
								)}
							</div>
						)}
					</div>
				);
			}

			case "text_delta": {
				const textDeltaData = message.data as
					| { index?: number; text?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium">Text Delta</div>
						<div className="text-sm bg-green-50 p-2 rounded border-l-2 border-green-300">
							<div className="text-xs text-muted-foreground mb-1">
								Block #{textDeltaData?.index}
							</div>
							<div className="font-mono">{textDeltaData?.text || ""}</div>
						</div>
					</div>
				);
			}

			case "thinking_delta": {
				const thinkingDeltaData = message.data as
					| { index?: number; thinking?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-purple-600">
							Thinking Delta
						</div>
						<div className="text-sm bg-purple-50 p-2 rounded border-l-2 border-purple-300">
							<div className="text-xs text-muted-foreground mb-1">
								Block #{thinkingDeltaData?.index}
							</div>
							<div className="font-mono text-xs">
								{thinkingDeltaData?.thinking || ""}
							</div>
						</div>
					</div>
				);
			}

			case "citations_delta": {
				const citationsDeltaData = message.data as
					| { index?: number; citation?: any }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-amber-600">
							Citation Added
						</div>
						{citationsDeltaData?.citation && (
							<div className="text-sm bg-amber-50 p-2 rounded border-l-2 border-amber-300">
								<div className="text-xs text-muted-foreground mb-1">
									Block #{citationsDeltaData.index}
								</div>
								<div className="text-xs font-mono">
									Type: {citationsDeltaData.citation.type}
								</div>
								<div className="text-xs italic mt-1">
									"{citationsDeltaData.citation.cited_text}"
								</div>
							</div>
						)}
					</div>
				);
			}

			case "content_block_stop": {
				const blockStopData = message.data as { index?: number } | undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-gray-600">
							Content Block Completed
						</div>
						<div className="text-sm text-muted-foreground">
							Block #{blockStopData?.index} finished
						</div>
					</div>
				);
			}

			case "message_delta": {
				const messageDeltaData = message.data as
					| { delta?: { stop_reason?: string; usage?: any } }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium">Message Update</div>
						{messageDeltaData?.delta && (
							<div className="text-sm text-muted-foreground">
								{messageDeltaData.delta.stop_reason && (
									<div>Stop Reason: {messageDeltaData.delta.stop_reason}</div>
								)}
								{messageDeltaData.delta.usage && (
									<div>
										Tokens: +{messageDeltaData.delta.usage.output_tokens}
									</div>
								)}
							</div>
						)}
					</div>
				);
			}

			case "message_stop": {
				const stopData = message.data as
					| { stop_reason?: string; total_tokens?: number }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-gray-600">
							Message Complete
						</div>
						{stopData && (
							<div className="text-sm text-muted-foreground">
								{stopData.stop_reason && (
									<div>Stop Reason: {stopData.stop_reason}</div>
								)}
								{stopData.total_tokens && (
									<div>Total Tokens: {stopData.total_tokens}</div>
								)}
							</div>
						)}
					</div>
				);
			}

			case "message": {
				const messageContent = message.data;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-green-600">
							Assistant Response
						</div>
						{messageContent ? (
							<div className="text-sm text-muted-foreground whitespace-pre-wrap bg-green-50 p-2 rounded border-l-2 border-green-300">
								{String(messageContent)}
							</div>
						) : (
							<div className="text-sm text-muted-foreground italic">
								Response processing in progress...
							</div>
						)}
					</div>
				);
			}

			case "thinking": {
				const thinkingData = message.data as
					| { thinking?: string; signature?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<ThinkingDisplay
							thinking={thinkingData?.thinking || ""}
							signature={thinkingData?.signature}
						/>
					</div>
				);
			}

			case "tool_use": {
				const toolData = message.data as
					| { tool?: string; params?: unknown; id?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium">
							Tool: {toolData?.tool || "Unknown"}
						</div>
						{toolData?.id && (
							<div className="text-xs text-muted-foreground font-mono">
								ID: {toolData.id}
							</div>
						)}
						{toolData?.params ? (
							<CodeBlock
								code={JSON.stringify(toolData.params, null, 2)}
								language="json"
							/>
						) : null}
					</div>
				);
			}

			case "server_tool_use": {
				const serverToolData = message.data as
					| { tool?: string; params?: unknown; id?: string }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-blue-600">
							Server Tool: {serverToolData?.tool || "Unknown"}
						</div>
						{serverToolData?.id && (
							<div className="text-xs text-muted-foreground font-mono">
								ID: {serverToolData.id}
							</div>
						)}
						{serverToolData?.params ? (
							<CodeBlock
								code={JSON.stringify(serverToolData.params, null, 2)}
								language="json"
							/>
						) : null}
					</div>
				);
			}

			case "tool_result": {
				const resultData = message.data as
					| { result?: unknown; is_error?: boolean }
					| undefined;
				return (
					<div className="space-y-2">
						<div
							className={`text-sm font-medium ${
								resultData?.is_error ? "text-red-600" : ""
							}`}
						>
							Tool Result {resultData?.is_error ? "(Error)" : ""}
						</div>
						{resultData?.result ? (
							<ToolResultDisplay result={resultData.result} />
						) : (
							<div className="text-sm text-muted-foreground italic">
								No result data available
							</div>
						)}
					</div>
				);
			}

			case "system": {
				const systemData = message.data;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-gray-600">
							System Message
						</div>
						{systemData ? (
							<div className="text-sm text-muted-foreground bg-gray-50 p-2 rounded border-l-2 border-gray-300">
								{typeof systemData === "string"
									? systemData
									: JSON.stringify(systemData, null, 2)}
							</div>
						) : (
							<div className="text-sm text-muted-foreground italic">
								System event (no data)
							</div>
						)}
					</div>
				);
			}

			case "result": {
				const genericResultData = message.data;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-purple-600">
							Processing Result
						</div>
						{genericResultData ? (
							<ToolResultDisplay result={genericResultData} />
						) : (
							<div className="text-sm text-muted-foreground italic">
								Processing completed (no result data)
							</div>
						)}
					</div>
				);
			}

			case "web_search_result": {
				const webSearchData = message.data as
					| {
							tool_use_id?: string;
							results?: WebSearchResult[];
							error?: WebSearchToolResultError;
					  }
					| undefined;
				return (
					<WebSearchDisplay
						toolUseId={webSearchData?.tool_use_id || "unknown"}
						results={webSearchData?.results}
						error={webSearchData?.error}
						timestamp={message.timestamp}
					/>
				);
			}

			case "complete": {
				const summaryData = message.data as
					| {
							summary?: {
								duration?: number;
								toolCallCount?: number;
								stop_reason?: string;
							};
					  }
					| undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-green-600">
							Stream Complete
						</div>
						{summaryData?.summary && (
							<div className="text-sm text-muted-foreground">
								<div>Duration: {summaryData.summary.duration}ms</div>
								<div>Tools: {summaryData.summary.toolCallCount}</div>
								{summaryData.summary.stop_reason && (
									<div>Stop Reason: {summaryData.summary.stop_reason}</div>
								)}
							</div>
						)}
					</div>
				);
			}

			case "error": {
				const errorData = message.data as
					| { error?: string; error_code?: string }
					| string
					| undefined;
				const errorMessage =
					typeof errorData === "object" && errorData?.error
						? errorData.error
						: typeof errorData === "string"
							? errorData
							: "Unknown error";
				const errorCode =
					typeof errorData === "object" ? errorData?.error_code : undefined;
				return (
					<div className="space-y-2">
						<div className="text-sm font-medium text-red-600">Error</div>
						<div className="text-sm text-red-600">{errorMessage}</div>
						{errorCode && (
							<div className="text-xs text-red-500 font-mono">
								Code: {errorCode}
							</div>
						)}
					</div>
				);
			}

			default:
				return (
					<div className="text-sm text-muted-foreground">
						<div className="text-xs mb-1">
							Unknown message type: {message.type}
						</div>
						{message.data !== null && message.data !== undefined ? (
							<details className="text-xs">
								<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
									Show raw data
								</summary>
								<pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 mt-1">
									{JSON.stringify(message.data, null, 2)}
								</pre>
							</details>
						) : (
							<div className="text-xs italic text-muted-foreground">
								No data for this message type
							</div>
						)}
					</div>
				);
		}
	};

	return (
		<Card className="text-xs border-l-4 border-l-primary/20">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<Badge
						variant="outline"
						className={`${getTypeColor(message.type)} text-xs`}
					>
						{getTypeIcon(message.type)}
						<span className="ml-1 capitalize">
							{message.type?.replace("_", " ") || "unknown"}
						</span>
					</Badge>
					<span className="text-xs text-muted-foreground">
						{message.timestamp ? formatTime(message.timestamp) : "No timestamp"}
					</span>
				</div>
			</CardHeader>
			<CardContent className="pt-0">{renderContent()}</CardContent>
		</Card>
	);
}

interface ToolResultDisplayProps {
	result: unknown;
}

function ToolResultDisplay({ result }: ToolResultDisplayProps) {
	const resultString =
		typeof result === "string" ? result : JSON.stringify(result, null, 2);

	// Check if this is a TODO list result
	const isTodoResult =
		typeof result === "object" &&
		result !== null &&
		"todos" in result &&
		Array.isArray((result as TodoList).todos);

	if (isTodoResult) {
		try {
			return <TodoListDisplay todos={result as TodoList} />;
		} catch (error) {
			console.warn("Failed to render TODO list:", error);
			// Fall through to default rendering
		}
	}

	// Check if this looks like a file diff or code
	const isFileDiff =
		resultString.includes("---") &&
		resultString.includes("+++") &&
		resultString.includes("@@");
	const hasCodeBlocks = resultString.includes("```");
	const isJSON =
		resultString.trim().startsWith("{") || resultString.trim().startsWith("[");

	if (hasCodeBlocks) {
		// Parse markdown code blocks
		const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
		const parts = [];
		let lastIndex = 0;
		let match;

		while ((match = codeBlockRegex.exec(resultString)) !== null) {
			// Add text before code block
			if (match.index > lastIndex) {
				const textBefore = resultString.slice(lastIndex, match.index);
				if (textBefore.trim()) {
					parts.push({ type: "text", content: textBefore });
				}
			}

			// Add code block
			parts.push({
				type: "code",
				language: match[1] || "text",
				content: match[2],
			});

			lastIndex = match.index + match[0].length;
		}

		// Add remaining text
		if (lastIndex < resultString.length) {
			const remaining = resultString.slice(lastIndex);
			if (remaining.trim()) {
				parts.push({ type: "text", content: remaining });
			}
		}

		return (
			<div className="space-y-2">
				{parts.map((part, index) =>
					part.type === "code" ? (
						<CodeBlock
							key={index}
							code={part.content}
							language={part.language || "text"}
						/>
					) : (
						<div
							key={index}
							className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap"
						>
							{part.content}
						</div>
					),
				)}
			</div>
		);
	}

	if (isFileDiff) {
		return (
			<div className="text-sm bg-muted p-3 rounded-md overflow-auto max-h-48">
				<pre className="whitespace-pre text-xs font-mono">
					{resultString.split("\n").map((line, index) => (
						<div
							key={index}
							className={`${
								line.startsWith("+") && !line.startsWith("+++")
									? "bg-green-50 text-green-800"
									: line.startsWith("-") && !line.startsWith("---")
										? "bg-red-50 text-red-800"
										: line.startsWith("@@")
											? "bg-blue-50 text-blue-800 font-semibold"
											: ""
							}`}
						>
							{line || " "}
						</div>
					))}
				</pre>
			</div>
		);
	}

	if (isJSON) {
		return <CodeBlock code={resultString} language="json" />;
	}

	// Default rendering for other content
	return (
		<div className="text-sm bg-muted p-3 rounded-md overflow-auto max-h-32">
			<pre className="whitespace-pre-wrap text-xs">{resultString}</pre>
		</div>
	);
}
