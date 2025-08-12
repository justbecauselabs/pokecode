import {
	AlertCircle,
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePolling } from "../../hooks/usePolling";
import { useChatStore } from "../../stores/chatStore";
import { useSessionStore } from "../../stores/sessionStore";
import { Button } from "../ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/Card";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
import { StatusBar } from "./StatusBar";
import { ChildMessageSidebar } from "./ChildMessageSidebar";

export function ChatContainer() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const navigate = useNavigate();

	const { currentSession, selectSession, sessions } = useSessionStore();
	const {
		currentPrompt,
		clearMessages,
		isWorking,
		setStreamingSidebarPromptId,
		streamingSidebarPromptId,
		messages,
	} = useChatStore();

	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	const { stopPolling } = usePolling({
		sessionId: sessionId || "",
		promptId: null, // Not needed for session-level polling
		enabled: Boolean(sessionId && isWorking),
	});

	// Use refs to store functions to avoid dependency issues
	const stopPollingRef = useRef(stopPolling);
	const clearMessagesRef = useRef(clearMessages);
	const selectSessionRef = useRef(selectSession);

	// Update refs when functions change
	stopPollingRef.current = stopPolling;
	clearMessagesRef.current = clearMessages;
	selectSessionRef.current = selectSession;

	useEffect(() => {
		if (sessionId) {
			// If we don't have the current session or it doesn't match, try to find and select it
			if (!currentSession || currentSession.id !== sessionId) {
				const session = sessions.find((s) => s.id === sessionId);
				if (session) {
					selectSessionRef.current(sessionId);
				}
			}
		}

		return () => {
			// Use ref values to avoid function dependencies
			stopPollingRef.current();
			clearMessagesRef.current();
		};
	}, [sessionId, currentSession, sessions]);

	const handleMessageSent = () => {
		// Polling will be established automatically via the usePolling hook
		// when currentPrompt is updated
		// Automatically show sidebar for new polling messages
		setIsSidebarCollapsed(false);
	};

	const handleBackToSessions = () => {
		stopPolling();
		navigate("/");
	};

	const handleShowChildMessages = (messageId: string) => {
		setStreamingSidebarPromptId(messageId);
		setIsSidebarCollapsed(false);
	};

	const handleToggleSidebar = () => {
		setIsSidebarCollapsed(!isSidebarCollapsed);
	};

	// Get the selected message and its child messages
	const selectedMessageId = streamingSidebarPromptId;
	const selectedMessage = selectedMessageId 
		? messages.find(msg => msg.id === selectedMessageId)
		: null;
	const childMessages = selectedMessage?.childMessages || [];

	const showSidebar = Boolean(selectedMessageId && !isSidebarCollapsed);

	if (!sessionId) {
		return (
			<div className="h-screen flex items-center justify-center">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-destructive" />
							Invalid Session
						</CardTitle>
						<CardDescription>No session ID provided in the URL</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={handleBackToSessions}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Sessions
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!currentSession) {
		return (
			<div className="h-screen flex items-center justify-center">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-destructive" />
							Session Not Found
						</CardTitle>
						<CardDescription>
							The requested session could not be found or loaded
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={handleBackToSessions}>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Sessions
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="h-screen flex bg-background">
			{/* Main Chat Area */}
			<div
				className={`flex flex-col transition-all duration-300 ${
					showSidebar
						? "w-full md:w-1/2" // Full width on mobile, half on desktop when sidebar is shown
						: "w-full"
				}`}
			>
				<StatusBar />

				{/* Header */}
				<div className="flex items-center gap-3 p-4 border-b">
					<Button variant="ghost" size="sm" onClick={handleBackToSessions}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Sessions
					</Button>
					<div className="flex-1 min-w-0">
						<h1
							className="text-lg font-semibold truncate"
							title={currentSession.projectPath}
						>
							{currentSession.projectPath.split("/").pop() ||
								currentSession.projectPath}
						</h1>
						{currentSession.context && (
							<p className="text-sm text-muted-foreground truncate">
								{currentSession.context}
							</p>
						)}
					</div>
					{/* Sidebar Toggle Button */}
					{selectedMessageId && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleToggleSidebar}
							className="ml-2"
						>
							{isSidebarCollapsed ? (
								<>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Show Messages
								</>
							) : (
								<>
									<ChevronRight className="h-4 w-4 mr-1" />
									Hide Messages
								</>
							)}
						</Button>
					)}
				</div>

				{/* Chat Messages */}
				<MessageList 
					sessionId={sessionId} 
					onShowStream={handleShowChildMessages}
				/>

				{/* Input Bar */}
				<InputBar
					sessionId={sessionId}
					onMessageSent={handleMessageSent}
					disabled={currentSession.status !== "active"}
				/>
			</div>

			{/* Child Messages Sidebar */}
			{showSidebar && (
				<div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:w-1/2 md:flex md:flex-col">
					{/* Mobile backdrop */}
					<div
						className="absolute inset-0 bg-black/50 md:hidden"
						onClick={handleToggleSidebar}
					/>
					<div className="relative ml-auto w-full h-full bg-black/5 md:bg-transparent">
						<ChildMessageSidebar
							messageId={selectedMessageId}
							childMessages={childMessages}
							onToggle={handleToggleSidebar}
							isStreaming={false}
							isCollapsed={false}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
