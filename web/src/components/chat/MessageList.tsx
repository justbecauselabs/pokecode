import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useSessionStore } from "../../stores/sessionStore";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
	sessionId: string;
	onShowStream?: (messageId: string) => void;
}

export function MessageList({ sessionId, onShowStream }: MessageListProps) {
	const {
		messages,
		isLoading,
		error,
		loadMessages,
		clearError,
		clearMessages,
	} = useChatStore();

	const { currentSession } = useSessionStore();

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Only load messages when we have both sessionId and the session is properly selected
		if (sessionId && currentSession && currentSession.id === sessionId) {
			clearMessages();
			loadMessages(sessionId);
		}
	}, [sessionId, currentSession, loadMessages, clearMessages]);

	useEffect(() => {
		// Auto-scroll to bottom when new messages arrive
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const retryLoading = () => {
		clearError();
		loadMessages(sessionId);
	};


	if (isLoading && messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading chat history...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<Card className="border-destructive max-w-md w-full">
					<CardContent className="pt-6 text-center">
						<p className="text-destructive mb-4">{error}</p>
						<Button onClick={retryLoading} variant="outline" size="sm">
							<RefreshCw className="h-4 w-4 mr-2" />
							Try Again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center">
					<h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
					<p className="text-muted-foreground">
						Send a message to begin chatting with Claude Code
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="flex-1 overflow-y-auto p-4 bg-black/5 font-mono"
			style={{ maxHeight: "calc(100vh - 200px)" }}
		>
			{messages.map((message) => (
				<MessageBubble
					key={message.id}
					message={message}
					onShowStream={onShowStream}
				/>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}
