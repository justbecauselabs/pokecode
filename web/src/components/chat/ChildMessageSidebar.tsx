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
import type { ChildMessage } from "../../types/chat";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ChildMessageRenderer } from "./ChildMessageRenderer";

interface ChildMessageSidebarProps {
	messageId: string | null;
	childMessages: ChildMessage[];
	onToggle: () => void;
	isStreaming?: boolean;
	isCollapsed?: boolean;
}

export function ChildMessageSidebar({
	messageId,
	childMessages,
	onToggle,
	isStreaming = false,
}: ChildMessageSidebarProps) {
	const [isMinimized, setIsMinimized] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [viewMode, setViewMode] = useState<"text" | "events">("text");

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (autoScroll && childMessages.length > 0) {
			const element = document.getElementById("child-messages-container");
			if (element) {
				element.scrollTop = element.scrollHeight;
			}
		}
	}, [childMessages.length, autoScroll]);

	if (!messageId) {
		return null;
	}

	const messageTypes = childMessages.reduce(
		(acc, msg) => {
			const type = msg.type || msg.role || 'unknown';
			acc[type] = (acc[type] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const startTime = childMessages[0]?.timestamp;
	const endTime = childMessages[childMessages.length - 1]?.timestamp;
	const duration =
		startTime && endTime
			? new Date(endTime).getTime() - new Date(startTime).getTime()
			: 0;

	return (
		<div
			className={`
      border-l bg-black/5 md:bg-muted/20 
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
						<MessageSquare className="h-5 w-5 text-purple-500" />
						Child Messages
						{childMessages.length > 0 && (
							<Badge variant="outline" className="text-xs">
								{childMessages.length}
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
										setViewMode(viewMode === "text" ? "events" : "text");
									}}
									className="h-10 w-10 p-0 text-base"
									title={
										viewMode === "text"
											? "Switch to events view"
											: "Switch to text view"
									}
								>
									{viewMode === "text" ? (
										<FileText className="h-6 w-6 text-purple-500" />
									) : (
										<List className="h-6 w-6 text-purple-500" />
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
											autoScroll ? "text-purple-500" : "text-gray-400"
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
							Message: {messageId.slice(0, 8)}...
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
					id="child-messages-container"
					className="flex-1 overflow-y-auto p-4"
					onScroll={(e) => {
						const element = e.currentTarget;
						const isAtBottom =
							element.scrollHeight - element.scrollTop <=
							element.clientHeight + 10;
						setAutoScroll(isAtBottom);
					}}
				>
					{childMessages.length === 0 ? (
						<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
							No child messages available
						</div>
					) : viewMode === "text" ? (
						<ChildMessageRenderer childMessages={childMessages} />
					) : (
						<div className="space-y-3">
							{childMessages.map((message) => (
								<div key={message.id} className="border rounded p-3 bg-card">
									<div className="text-xs text-muted-foreground mb-2">
										{message.role || message.type} - {new Date(message.timestamp).toLocaleTimeString()}
									</div>
									<div className="text-sm whitespace-pre-wrap">
										{message.content}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Minimized state indicator */}
			{isMinimized && (
				<div className="flex-1 flex flex-col items-center justify-center p-2 space-y-2">
					<MessageSquare className="h-6 w-6 text-purple-500" />
					<div className="text-xs text-muted-foreground text-center">
						{childMessages.length}
					</div>
				</div>
			)}
		</div>
	);
}
