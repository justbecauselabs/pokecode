import { useMemo } from "react";
import type { ChildMessage } from "../../types/chat";
import { CodeBlock } from "../ui/CodeBlock";

interface ChildMessageRendererProps {
	childMessages: ChildMessage[];
}

interface TextBlock {
	type: "text" | "thinking" | "code" | "system" | "error";
	content: string;
	language?: string;
	timestamp: string;
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
				contentLength: message.content?.length
			});

			// For ChildMessage format, we have content directly
			if (message.content && message.content.trim()) {
				// Determine the type of content based on role/type
				let blockType: TextBlock["type"] = "text";
				
				if (message.role === "assistant" || message.type === "assistant") {
					blockType = "text";
				} else if (message.role === "user" || message.type === "user") {
					blockType = "text";
				} else if (message.type === "system") {
					blockType = "system";
				} else if (message.type === "error") {
					blockType = "error";
				} else if (message.type === "thinking") {
					blockType = "thinking";
				} else if (message.content.startsWith("[Tool:") || message.content.includes("```")) {
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
				});
			} else {
				console.log("Skipping message with no content:", {
					id: message.id,
					hasContent: !!message.content,
					contentType: typeof message.content
				});
			}
		}

		return blocks;
	}, [childMessages]);

	// Group consecutive blocks of the same type for better rendering
	const groupedBlocks = useMemo(() => {
		const grouped: Array<{
			type: TextBlock["type"];
			content: string;
			language?: string;
			startTime: string;
			endTime: string;
		}> = [];

		let currentGroup: TextBlock[] = [];

		for (const block of textBlocks) {
			if (currentGroup.length === 0 || currentGroup[0].type === block.type) {
				currentGroup.push(block);
			} else {
				// Process current group
				if (currentGroup.length > 0) {
					grouped.push({
						type: currentGroup[0].type,
						content: currentGroup.map((b) => b.content).join(""),
						language: currentGroup[0].language,
						startTime: currentGroup[0].timestamp,
						endTime: currentGroup[currentGroup.length - 1].timestamp,
					});
				}
				currentGroup = [block];
			}
		}

		// Process final group
		if (currentGroup.length > 0) {
			grouped.push({
				type: currentGroup[0].type,
				content: currentGroup.map((b) => b.content).join(""),
				language: currentGroup[0].language,
				startTime: currentGroup[0].timestamp,
				endTime: currentGroup[currentGroup.length - 1].timestamp,
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
							<div key={index} className="prose prose-sm max-w-none">
								<div className="whitespace-pre-wrap leading-relaxed text-foreground">
									{group.content}
								</div>
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
								<div className="text-purple-800 whitespace-pre-wrap leading-relaxed font-mono text-xs">
									{group.content}
								</div>
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
								<div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
									{group.content}
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
								<div className="text-red-800 whitespace-pre-wrap leading-relaxed">
									{group.content}
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
