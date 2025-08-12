import { formatDistanceToNow } from "date-fns";
import { Activity, Bot, Copy, MessageSquare, Settings, User } from "lucide-react";
import { useMessageParser } from "../../hooks/useMessageParser";
import type { ChatMessage } from "../../types/chat";
import { Badge } from "../ui/Badge";
import { CodeBlock } from "../ui/CodeBlock";
import { ErrorDisplay } from "../ui/ErrorDisplay";
import { FileOperationDisplay } from "../ui/FileOperationDisplay";
import { ToolDisplay } from "../ui/ToolDisplay";
import { CitationDisplay, parseTextWithCitations } from "./CitationDisplay";
import { ThinkingDisplay } from "./ThinkingDisplay";

interface MessageBubbleProps {
	message: ChatMessage;
	onShowStream?: (messageId: string) => void;
}

export function MessageBubble({ message, onShowStream }: MessageBubbleProps) {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	const getRoleIcon = () => {
		switch (message.role) {
			case "user":
				return <User className="h-4 w-4" />;
			case "assistant":
				return <Bot className="h-4 w-4" />;
			case "system":
				return <Settings className="h-4 w-4" />;
			default:
				return null;
		}
	};

	const getRoleLabel = () => {
		switch (message.role) {
			case "user":
				return "You";
			case "assistant":
				return "Claude";
			case "system":
				return "System";
			default:
				return "Unknown";
		}
	};

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(message.content);
		} catch (error) {
			console.error("Failed to copy to clipboard:", error);
		}
	};

	if (isSystem) {
		return (
			<div className="flex justify-center my-2">
				<Badge variant="outline" className="text-xs">
					{getRoleIcon()}
					<span className="ml-1">{message.content}</span>
				</Badge>
			</div>
		);
	}

	return (
		<div className="w-full text-left mb-6">
			<div className="flex items-start justify-start gap-2 mb-1 font-mono text-xs text-muted-foreground">
				<span className={
					message.role === "user" ? "text-white" : 
					message.role === "assistant" ? "text-green-400" : 
					"text-muted-foreground"
				}>{getRoleLabel()}</span>
				<span>•</span>
				<span>{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
				{message.isStreaming && (
					<Badge variant="outline" className="text-xs">
						<div className="w-2 h-2 bg-current rounded-full animate-pulse" />
						<span className="ml-1">Typing...</span>
					</Badge>
				)}
				{message.isWorking && (
					<Badge 
						variant="outline" 
						className="text-xs cursor-pointer hover:bg-accent" 
						onClick={() => message.promptId && onShowStream?.(message.promptId)}
					>
						<Activity className="w-2 h-2 animate-spin" />
						<span className="ml-1">Working... (click to view)</span>
					</Badge>
				)}
			</div>

			<div className="text-left">
				<div className="font-mono text-sm leading-relaxed">
					<MessageContent
						content={message.content}
						thinking={message.thinking}
						signature={message.signature}
						citations={message.citations}
						isStreaming={message.isStreaming}
					/>
				</div>

				{/* Action buttons at bottom - always visible for non-system messages */}
				{!isSystem && (
					<div className="flex gap-2 mt-2 text-xs">
						{/* Show child messages button when there are childMessages */}
						{message.childMessages && message.childMessages.length > 0 && onShowStream && (
							<button
								onClick={() => onShowStream(message.id)}
								className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
								title="View child messages"
							>
								<MessageSquare className="h-3 w-3" />
								<span>Messages ({message.childMessages.length})</span>
							</button>
						)}
						<button
							onClick={copyToClipboard}
							className="flex items-center gap-1 text-gray-400 hover:text-gray-300 transition-colors"
							title="Copy message"
						>
							<Copy className="h-3 w-3" />
							<span>Copy</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

interface MessageContentProps {
	content: string;
	thinking?: string;
	signature?: string;
	citations?: any[];
	isStreaming?: boolean;
}

function MessageContent({
	content,
	thinking,
	signature,
	citations,
	isStreaming,
}: MessageContentProps) {
	const { parseMessageContent } = useMessageParser();
	const blocks = parseMessageContent(content);

	return (
		<div className="space-y-2">
			{/* Thinking content (if available) */}
			{thinking && (
				<ThinkingDisplay
					thinking={thinking}
					signature={signature}
					isStreaming={isStreaming}
				/>
			)}

			{/* Main content blocks */}
			{blocks.map((block, index) => {
				switch (block.type) {
					case "code":
						return (
							<div key={index} className="text-left">
								<CodeBlock
									language={block.language || "text"}
									code={block.content}
									showLineNumbers={false}
								/>
							</div>
						);
					case "tool":
						return (
							<div key={index} className="text-left">
								<ToolDisplay
									content={block.content}
									metadata={block.metadata}
								/>
							</div>
						);
					case "error":
						return (
							<div key={index} className="text-left">
								<ErrorDisplay
									content={block.content}
									severity={
										block.content.includes("Warning") ? "warning" : "error"
									}
								/>
							</div>
						);
					case "file":
						return (
							<div key={index} className="text-left">
								<FileOperationDisplay
									content={block.content}
									metadata={block.metadata}
								/>
							</div>
						);
					case "text":
					default:
						return (
							<div key={index} className="whitespace-pre-wrap break-words text-left">
								{citations && citations.length > 0 ? (
									<div>{parseTextWithCitations(block.content, citations)}</div>
								) : (
									block.content
								)}
							</div>
						);
				}
			})}

			{/* Citations (if available) */}
			{citations && citations.length > 0 && (
				<div className="text-left">
					<CitationDisplay citations={citations} />
				</div>
			)}
		</div>
	);
}
