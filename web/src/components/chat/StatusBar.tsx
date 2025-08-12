import { AlertCircle, Folder, Wifi, WifiOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chatStore";
import { useSessionStore } from "../../stores/sessionStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface StatusBarProps {
	className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
	const { isConnected, isWorking, connectionError } = useChatStore();
	const { currentSession } = useSessionStore();

	const getConnectionStatus = () => {
		if (connectionError) {
			return {
				icon: AlertCircle,
				label: "Error",
				variant: "destructive" as const,
				color: "text-destructive",
			};
		}

		if (isWorking) {
			return {
				icon: Wifi,
				label: "Working",
				variant: "default" as const,
				color: "text-green-600",
			};
		}

		if (isConnected) {
			return {
				icon: Wifi,
				label: "Connected",
				variant: "outline" as const,
				color: "text-green-600",
			};
		}

		return {
			icon: WifiOff,
			label: "Disconnected",
			variant: "outline" as const,
			color: "text-muted-foreground",
		};
	};

	const truncatePath = (path: string, maxLength: number = 30) => {
		if (path.length <= maxLength) return path;
		return "..." + path.slice(-(maxLength - 3));
	};

	const status = getConnectionStatus();
	const StatusIcon = status.icon;

	return (
		<div
			className={cn(
				"flex items-center justify-between px-4 py-2 bg-muted/50 border-b text-sm",
				className,
			)}
		>
			<div className="flex items-center gap-4">
				{/* App name and connection status */}
				<div className="flex items-center gap-2">
					<span className="font-semibold">Pokecode</span>
					<Badge variant={status.variant} className="text-xs">
						<StatusIcon className={cn("h-3 w-3 mr-1", status.color)} />
						{status.label}
					</Badge>
				</div>

			</div>

			<div className="flex items-center gap-4">
				{/* Session info */}
				{currentSession && (
					<div className="flex items-center gap-1 text-muted-foreground">
						<Folder className="h-3 w-3" />
						<span className="text-xs" title={currentSession.projectPath}>
							{truncatePath(currentSession.projectPath)}
						</span>
						{currentSession.context && (
							<span className="text-xs text-muted-foreground/70">
								• {currentSession.context.slice(0, 20)}
								{currentSession.context.length > 20 ? "..." : ""}
							</span>
						)}
					</div>
				)}

				{/* Error indicator with tooltip */}
				{connectionError && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-xs text-destructive hover:text-destructive"
						title={connectionError}
					>
						Connection Error
					</Button>
				)}
			</div>
		</div>
	);
}
