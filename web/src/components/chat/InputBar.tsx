import { Send, Square } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chatStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface InputBarProps {
	sessionId: string;
	onMessageSent?: (promptId: string) => void;
	disabled?: boolean;
}

export function InputBar({
	sessionId,
	onMessageSent,
	disabled,
}: InputBarProps) {
	const { sendMessage, isLoading, isWorking, error, clearError } =
		useChatStore();
	const [message, setMessage] = useState("");
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const isSending = isLoading || isWorking;

	useEffect(() => {
		if (textareaRef.current) {
			// Auto-resize textarea
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height =
				textareaRef.current.scrollHeight + "px";
		}
	}, [message]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const trimmedMessage = message.trim();
		if (!trimmedMessage || isSending || disabled) return;

		clearError();

		try {
			// Add to history
			setHistory((prev) => [trimmedMessage, ...prev.slice(0, 49)]); // Keep last 50
			setHistoryIndex(-1);

			const promptId = await sendMessage(sessionId, trimmedMessage);
			setMessage("");

			if (onMessageSent) {
				onMessageSent(promptId);
			}
		} catch (error) {
			// Error is handled by the store
			console.error("Failed to send message:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		} else if (
			e.key === "ArrowUp" &&
			(e.currentTarget as HTMLTextAreaElement).selectionStart === 0
		) {
			e.preventDefault();
			if (historyIndex < history.length - 1) {
				const newIndex = historyIndex + 1;
				setHistoryIndex(newIndex);
				setMessage(history[newIndex] || "");
			}
		} else if (
			e.key === "ArrowDown" &&
			(e.currentTarget as HTMLTextAreaElement).selectionStart === message.length
		) {
			e.preventDefault();
			if (historyIndex > 0) {
				const newIndex = historyIndex - 1;
				setHistoryIndex(newIndex);
				setMessage(history[newIndex] || "");
			} else if (historyIndex === 0) {
				setHistoryIndex(-1);
				setMessage("");
			}
		}
	};

	const handleStopGeneration = () => {
		// TODO: Implement stop generation API call
		console.log("Stop generation requested");
	};

	return (
		<div className="border-t border-border bg-background p-4">
			{error && (
				<div className="mb-3 text-sm text-destructive font-medium border border-destructive/20 bg-destructive/5 px-3 py-2 rounded-sm">
					{error}
				</div>
			)}

			<Card className="overflow-hidden bg-card border-border">
				<form onSubmit={handleSubmit} className="flex items-end gap-3 p-3">
					{/* Terminal prompt indicator */}
					<div className="flex items-end pb-1">
						<span className="text-accent font-bold text-sm terminal-text">
							$
						</span>
					</div>

					<div className="flex-1 min-h-0">
						<textarea
							ref={textareaRef}
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Enter command..."
							className={cn(
								"w-full resize-none border-0 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 terminal-text",
								"min-h-[20px] max-h-[200px] overflow-y-auto",
							)}
							rows={1}
							disabled={disabled || isSending}
							style={{ scrollbarWidth: "thin" }}
						/>
					</div>

					<div className="flex gap-1">
						{isWorking && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={handleStopGeneration}
								disabled={disabled}
							>
								<Square className="h-4 w-4" />
							</Button>
						)}

						<Button
							type="submit"
							size="sm"
							disabled={disabled || !message.trim() || isSending}
							className="flex-shrink-0"
						>
							{isSending ? (
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</div>
				</form>
			</Card>

			<div className="mt-3 text-xs text-muted-foreground terminal-text flex items-center gap-4">
				<span className="flex items-center gap-1">
					<kbd className="px-2 py-1 rounded-sm bg-secondary border border-border text-secondary-foreground font-mono">
						Enter
					</kbd>
					<span>run</span>
				</span>
				<span className="flex items-center gap-1">
					<kbd className="px-2 py-1 rounded-sm bg-secondary border border-border text-secondary-foreground font-mono">
						Shift+↵
					</kbd>
					<span>newline</span>
				</span>
				<span className="flex items-center gap-1">
					<kbd className="px-2 py-1 rounded-sm bg-secondary border border-border text-secondary-foreground font-mono">
						↑↓
					</kbd>
					<span>history</span>
				</span>
			</div>
		</div>
	);
}
