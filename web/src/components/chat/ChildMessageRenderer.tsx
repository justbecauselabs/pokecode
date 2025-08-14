import { useMemo } from "react";
import type { ChildMessage } from "../../types/chat";
import { CodeBlock } from "../ui/CodeBlock";
import { MarkdownRenderer } from "../ui/MarkdownRenderer";
import { ToolDisplay } from "../ui/ToolDisplay";

interface ChildMessageRendererProps {
	childMessages: ChildMessage[];
}

interface TextBlock {
	type: "text" | "thinking" | "code" | "system" | "error" | "tool";
	content: string;
	language?: string;
	timestamp: string;
	metadata?: Record<string, any>;
}

export function ChildMessageRenderer({
	childMessages,
}: ChildMessageRendererProps) {
	const textBlocks = useMemo(() => {
		const blocks: TextBlock[] = [];

		console.log(
			"ChildMessageRenderer processing",
			childMessages.length,
			"messages:",
			childMessages,
		);

		// Process messages chronologically
		const sortedMessages = [...childMessages].sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		for (const message of sortedMessages) {
			const timestamp = message.timestamp;
			console.log("Processing message:", {
				id: message.id,
				type: message.type,
				role: message.role,
				content: message.content,
				contentLength: message.content?.length,
				metadata: message.metadata
			});

			// Check for tool calls in metadata
			if (message.metadata?.toolCalls && message.metadata.toolCalls.length > 0) {
				for (const toolCall of message.metadata.toolCalls) {
					blocks.push({
						type: "tool",
						content: `🔧 **Tool:** ${toolCall.name}\n\n**Input:**\n\`\`\`json\n${JSON.stringify(toolCall.input, null, 2)}\n\`\`\``,
						timestamp,
						metadata: { isToolCall: true, toolName: toolCall.name }
					});
				}
			}

			// Check for tool results in metadata
			if (message.metadata?.toolResults && message.metadata.toolResults.length > 0) {
				for (const toolResult of message.metadata.toolResults) {
					blocks.push({
						type: "tool",
						content: `✅ **Tool Result** (${toolResult.toolUseId.substring(0, 8)}...)\n\n${toolResult.content}`,
						timestamp,
						metadata: { isToolResult: true, toolUseId: toolResult.toolUseId }
					});
				}
			}

			// Check for thinking in metadata
			if (message.metadata?.thinking) {
				blocks.push({
					type: "thinking",
					content: message.metadata.thinking,
					timestamp,
					metadata: {}
				});
			}

			// For ChildMessage format, we have content directly
			if (message.content && message.content.trim()) {
				// Determine the type of content based on role/type and content patterns
				let blockType: TextBlock["type"] = "text";
				
				// Check for tool usage patterns first
				if (message.content.includes("🔧") || 
					message.content.match(/Using tool:|Tool:|Executing:|^\[Tool:/) ||
					message.content.match(/^(Read|Write|Edit|Bash|Search|Grep|Glob|Task|WebFetch|TodoWrite|ExitPlanMode)/)) {
					blockType = "tool";
				} else if (message.role === "assistant" || message.type === "assistant") {
					blockType = "text";
				} else if (message.role === "user" || message.type === "user") {
					blockType = "text";
				} else if (message.type === "system") {
					blockType = "system";
				} else if (message.type === "error") {
					blockType = "error";
				} else if (message.type === "thinking") {
					blockType = "thinking";
				} else if (message.content.includes("```")) {
					blockType = "code";
				}

				console.log("Adding text block:", {
					type: blockType,
					contentPreview: message.content.substring(0, 50),
					timestamp
				});

				blocks.push({
					type: blockType,
					content: message.content,
					timestamp,
					metadata: blockType === "tool" ? { isToolUse: true } : undefined,
				});
			} else if (!message.metadata?.toolCalls && !message.metadata?.toolResults && !message.metadata?.thinking) {
				console.log("Skipping message with no content or metadata:", {
					id: message.id,
					hasContent: !!message.content,
					contentType: typeof message.content
				});
			}
		}

		return blocks;
	}, [childMessages]);

	// Keep each message separate for individual rendering
	const groupedBlocks = useMemo(() => {
		const grouped: Array<{
			type: TextBlock["type"];
			content: string;
			language?: string;
			metadata?: Record<string, any>;
			startTime: string;
			endTime: string;
		}> = [];

		// Each text block becomes its own group to ensure separate rendering
		for (const block of textBlocks) {
			grouped.push({
				type: block.type,
				content: block.content,
				language: block.language,
				metadata: block.metadata,
				startTime: block.timestamp,
				endTime: block.timestamp,
			});
		}

		return grouped;
	}, [textBlocks]);

	console.log(
		"ChildMessageRenderer final blocks:",
		textBlocks.length,
		"textBlocks,",
		groupedBlocks.length,
		"groupedBlocks",
	);

	if (groupedBlocks.length === 0) {
		// Fallback: show raw messages if no text blocks were extracted
		if (childMessages.length > 0) {
			return (
				<div className="space-y-2">
					<div className="text-xs text-muted-foreground mb-2">
						Debug: Showing raw messages ({childMessages.length} found, {textBlocks.length} text blocks extracted)
					</div>
					{childMessages.map((msg, index) => (
						<div key={msg.id || index} className="border rounded p-2 bg-muted/50">
							<div className="text-xs text-muted-foreground mb-1">
								{msg.role || msg.type || 'unknown'} - {new Date(msg.timestamp).toLocaleTimeString()}
							</div>
							<div className="text-sm">
								{msg.content || '(no content)'}
							</div>
							<details className="mt-1">
								<summary className="text-xs cursor-pointer">Raw data</summary>
								<pre className="text-xs bg-background p-1 rounded mt-1">
									{JSON.stringify(msg, null, 2)}
								</pre>
							</details>
						</div>
					))}
				</div>
			);
		}

		return (
			<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
				<div className="text-center">
					<div>No child messages available</div>
					<div className="text-xs mt-2">
						Processed {childMessages.length} child messages, found{" "}
						{textBlocks.length} text blocks
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 text-sm">
			{groupedBlocks.map((group, index) => {
				switch (group.type) {
					case "text":
						return (
							<div key={index}>
								<MarkdownRenderer content={group.content} />
							</div>
						);

					case "thinking":
						return (
							<div
								key={index}
								className="bg-purple-50 border-l-4 border-purple-300 p-4 rounded-r-md"
							>
								<div className="text-xs text-purple-600 font-medium mb-2 flex items-center gap-1">
									<span>💭</span> Thinking
								</div>
								<div className="text-purple-800 font-mono text-xs">
									<MarkdownRenderer content={group.content} />
								</div>
							</div>
						);

					case "tool":
						return (
							<div key={index}>
								<ToolDisplay
									content={group.content}
									metadata={group.metadata}
								/>
							</div>
						);

					case "code": {
						// Try to extract language from markdown code blocks
						const codeBlockMatch = group.content.match(
							/```(\w*)\n?([\s\S]*?)```/,
						);
						if (codeBlockMatch) {
							return (
								<div key={index} className="my-4">
									<CodeBlock
										code={codeBlockMatch[2]}
										language={codeBlockMatch[1] || "text"}
									/>
								</div>
							);
						}

						// Check if it looks like JSON
						const isJSON =
							group.content.trim().startsWith("{") ||
							group.content.trim().startsWith("[");

						return (
							<div key={index} className="my-4">
								<CodeBlock
									code={group.content}
									language={isJSON ? "json" : "text"}
								/>
							</div>
						);
					}

					case "system": {
						return (
							<div
								key={index}
								className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r-md"
							>
								<div className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1">
									<span>⚙️</span> System
								</div>
								<div className="text-gray-700">
									<MarkdownRenderer content={group.content} />
								</div>
							</div>
						);
					}

					case "error": {
						return (
							<div
								key={index}
								className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md"
							>
								<div className="text-xs text-red-600 font-medium mb-2 flex items-center gap-1">
									<span>❌</span> Error
								</div>
								<div className="text-red-800">
									<MarkdownRenderer content={group.content} />
								</div>
							</div>
						);
					}

					default:
						return null;
				}
			})}
		</div>
	);
}
