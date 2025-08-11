import {
	Activity,
	ChevronRight,
	Clock,
	FileText,
	List,
	Maximize2,
	MessageSquare,
	Minimize2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import type { ChatMessage, StreamMessage as StreamMessageType } from "../../types/chat";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { StreamMessageErrorBoundary } from "../ui/StreamMessageErrorBoundary";
import { StreamMessage } from "./StreamMessage";
import { StreamTextRenderer } from "./StreamTextRenderer";

interface StreamSidebarProps {
	promptId: string | null;
	streamMessages: StreamMessageType[];
	intermediateMessages?: ChatMessage[];
	onToggle: () => void;
	isStreaming?: boolean;
	isCollapsed?: boolean;
}

export function StreamSidebar({
	promptId,
	streamMessages,
	intermediateMessages = [],
	onToggle,
	isStreaming = false,
}: StreamSidebarProps) {
	const [isMinimized, setIsMinimized] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [viewMode, setViewMode] = useState<"text" | "events" | "intermediate">("text");

	// Auto-switch to intermediate view when intermediate messages are available and stream messages are empty
	useEffect(() => {
		if (intermediateMessages.length > 0 && streamMessages.length === 0) {
			setViewMode("intermediate");
		} else if (streamMessages.length > 0 && viewMode === "intermediate") {
			setViewMode("text");
		}
	}, [intermediateMessages.length, streamMessages.length, viewMode]);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (autoScroll && streamMessages.length > 0) {
			const element = document.getElementById("stream-messages-container");
			if (element) {
				element.scrollTop = element.scrollHeight;
			}
		}
	}, [streamMessages.length, autoScroll]);

	if (!promptId) {
		return null;
	}

	const messageTypes = streamMessages.reduce(
		(acc, msg) => {
			acc[msg.type] = (acc[msg.type] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const startTime = streamMessages[0]?.timestamp;
	const endTime = streamMessages[streamMessages.length - 1]?.timestamp;
	const duration =
		startTime && endTime
			? new Date(endTime).getTime() - new Date(startTime).getTime()
			: 0;

	return (
		<div
			className={`
      border-l bg-background md:bg-muted/20 
      flex flex-col h-full transition-all duration-300 
      ${isMinimized ? "w-16" : "w-full"}
      md:relative z-50 md:z-auto
    `}
		>
			<div className="p-4 border-b bg-background">
				<div className="flex items-center justify-between mb-3">
					<h3
						className={`font-medium flex items-center gap-2 ${
							isMinimized ? "hidden" : ""
						}`}
					>
						<Activity
							className={`h-5 w-5 ${
								isStreaming ? "animate-pulse text-blue-500" : ""
							}`}
						/>
						Live Stream
						{isStreaming && (
							<Badge variant="outline" className="text-xs animate-pulse">
								Active
							</Badge>
						)}
					</h3>
					<div className="flex items-center gap-1">
						{!isMinimized && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										if (viewMode === "text") {
											setViewMode("events");
										} else if (viewMode === "events") {
											setViewMode("intermediate");
										} else {
											setViewMode("text");
										}
									}}
									className="h-10 w-10 p-0 text-base"
									title={
										viewMode === "text"
											? "Switch to events view"
											: viewMode === "events"
											? "Switch to intermediate messages"
											: "Switch to text view"
									}
								>
									{viewMode === "text" ? (
										<FileText className="h-6 w-6 text-blue-500" />
									) : viewMode === "events" ? (
										<List className="h-6 w-6 text-blue-500" />
									) : (
										<MessageSquare className="h-6 w-6 text-blue-500" />
									)}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setAutoScroll(!autoScroll)}
									className="h-10 w-10 p-0 text-base"
									title={
										autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"
									}
								>
									<Clock
										className={`h-6 w-6 ${
											autoScroll ? "text-blue-500" : "text-gray-400"
										}`}
									/>
								</Button>
							</>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsMinimized(!isMinimized)}
							className="h-10 w-10 p-0 text-base"
							title={isMinimized ? "Expand sidebar" : "Minimize sidebar"}
						>
							{isMinimized ? (
								<Maximize2 className="h-6 w-6" />
							) : (
								<Minimize2 className="h-6 w-6" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onToggle}
							className="h-10 w-10 p-0 text-base"
							title="Hide sidebar"
						>
							<ChevronRight className="h-6 w-6" />
						</Button>
					</div>
				</div>

				{!isMinimized && (
					<div className="space-y-2">
						<div className="text-xs text-muted-foreground font-mono">
							Prompt: {promptId.slice(0, 8)}...
						</div>

						<div className="flex flex-wrap gap-1">
							{Object.entries(messageTypes).map(([type, count]) => (
								<Badge key={type} variant="secondary" className="text-xs">
									{type}: {count}
								</Badge>
							))}
						</div>

						{duration > 0 && (
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Clock className="h-3 w-3" />
								{(duration / 1000).toFixed(1)}s
							</div>
						)}
					</div>
				)}
			</div>

			{!isMinimized && (
				<div
					id="stream-messages-container"
					className="flex-1 overflow-y-auto p-4"
					onScroll={(e) => {
						const element = e.currentTarget;
						const isAtBottom =
							element.scrollHeight - element.scrollTop <=
							element.clientHeight + 10;
						setAutoScroll(isAtBottom);
					}}
				>
					{viewMode === "intermediate" ? (
						<div className="space-y-3">
							{intermediateMessages.length === 0 ? (
								<div className="text-center text-sm text-muted-foreground p-4">
									No intermediate messages available
								</div>
							) : (
								intermediateMessages.map((message, index) => (
									<div
										key={message.id}
										className="border border-muted rounded-lg p-3 bg-background/50"
									>
										<div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
											<Badge variant="secondary" className="text-xs">
												{message.role}
											</Badge>
											<span>
												{formatDistanceToNow(message.timestamp, { addSuffix: true })}
											</span>
										</div>
										<div className="font-mono text-sm whitespace-pre-wrap">
											{message.content}
										</div>
									</div>
								))
							)}
						</div>
					) : streamMessages.length === 0 ? (
						<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
							{isStreaming ? (
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
									Waiting for stream messages...
								</div>
							) : (
								"No stream messages yet"
							)}
						</div>
					) : viewMode === "text" ? (
						<StreamTextRenderer streamMessages={streamMessages} />
					) : (
						<div className="space-y-3">
							{streamMessages.map((message) => (
								<StreamMessageErrorBoundary
									key={message.id}
									messageId={message.id}
									messageType={message.type}
								>
									<StreamMessage message={message} />
								</StreamMessageErrorBoundary>
							))}
						</div>
					)}
				</div>
			)}

			{/* Minimized state indicator */}
			{isMinimized && (
				<div className="flex-1 flex flex-col items-center justify-center p-2 space-y-2">
					<Activity
						className={`h-6 w-6 ${
							isStreaming ? "animate-pulse text-blue-500" : "text-gray-400"
						}`}
					/>
					<div className="text-xs text-muted-foreground text-center">
						{streamMessages.length}
					</div>
					{isStreaming && (
						<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
					)}
				</div>
			)}
		</div>
	);
}
