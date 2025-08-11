import {
	AlertCircle,
	CheckCircle,
	Clock,
	Pause,
	Settings,
	Shield,
	Square,
} from "lucide-react";
import type { StopReason } from "../../types/chat";
import { Badge } from "./Badge";

interface StopReasonDisplayProps {
	stopReason: StopReason;
	className?: string;
}

export function StopReasonDisplay({
	stopReason,
	className = "",
}: StopReasonDisplayProps) {
	const getStopReasonConfig = (reason: StopReason) => {
		switch (reason) {
			case "end_turn":
				return {
					icon: <CheckCircle className="h-3 w-3" />,
					label: "Completed",
					description: "Response completed naturally",
					variant: "default" as const,
					color: "bg-green-100 text-green-800 border-green-200",
				};
			case "max_tokens":
				return {
					icon: <Square className="h-3 w-3" />,
					label: "Token Limit",
					description: "Reached maximum token limit",
					variant: "secondary" as const,
					color: "bg-orange-100 text-orange-800 border-orange-200",
				};
			case "stop_sequence":
				return {
					icon: <Square className="h-3 w-3" />,
					label: "Stop Sequence",
					description: "Custom stop sequence encountered",
					variant: "outline" as const,
					color: "bg-blue-100 text-blue-800 border-blue-200",
				};
			case "tool_use":
				return {
					icon: <Settings className="h-3 w-3" />,
					label: "Tool Required",
					description: "Stopped to use tools",
					variant: "secondary" as const,
					color: "bg-purple-100 text-purple-800 border-purple-200",
				};
			case "pause_turn":
				return {
					icon: <Pause className="h-3 w-3" />,
					label: "Paused",
					description: "Turn paused for continuation",
					variant: "outline" as const,
					color: "bg-yellow-100 text-yellow-800 border-yellow-200",
				};
			case "refusal":
				return {
					icon: <Shield className="h-3 w-3" />,
					label: "Refused",
					description: "Request refused by safety systems",
					variant: "destructive" as const,
					color: "bg-red-100 text-red-800 border-red-200",
				};
			default:
				return {
					icon: <Clock className="h-3 w-3" />,
					label: "Unknown",
					description: "Unknown stop reason",
					variant: "outline" as const,
					color: "bg-gray-100 text-gray-800 border-gray-200",
				};
		}
	};

	const config = getStopReasonConfig(stopReason);

	return (
		<Badge
			variant={config.variant}
			className={`${config.color} ${className}`}
			title={config.description}
		>
			{config.icon}
			<span className="ml-1">{config.label}</span>
		</Badge>
	);
}

interface StopReasonDetailProps {
	stopReason: StopReason;
	stopSequence?: string;
	className?: string;
}

// Helper function moved up for proper declaration order
function getStopReasonConfigForDetail(
	reason: StopReason,
	stopSequence?: string,
) {
	switch (reason) {
		case "end_turn":
			return {
				icon: <CheckCircle className="h-4 w-4" />,
				label: "Response Completed",
				description:
					"The assistant completed its response naturally without any interruptions.",
				color: "text-green-600",
				bgColor: "bg-green-50 border-green-200",
			};
		case "max_tokens":
			return {
				icon: <Square className="h-4 w-4" />,
				label: "Token Limit Reached",
				description:
					"The response was truncated because it reached the maximum allowed token limit. Consider increasing the token limit or breaking the request into smaller parts.",
				color: "text-orange-600",
				bgColor: "bg-orange-50 border-orange-200",
			};
		case "stop_sequence":
			return {
				icon: <Square className="h-4 w-4" />,
				label: "Stop Sequence Encountered",
				description: `The response was stopped because a custom stop sequence was encountered${stopSequence ? `: "${stopSequence}"` : "."} This is typically used for structured output or specific formatting.`,
				color: "text-blue-600",
				bgColor: "bg-blue-50 border-blue-200",
			};
		case "tool_use":
			return {
				icon: <Settings className="h-4 w-4" />,
				label: "Tool Use Required",
				description:
					"The assistant needs to use tools to continue. Tool results will be processed and the response will continue.",
				color: "text-purple-600",
				bgColor: "bg-purple-50 border-purple-200",
			};
		case "pause_turn":
			return {
				icon: <Pause className="h-4 w-4" />,
				label: "Turn Paused",
				description:
					"The conversation turn was paused and can be continued with additional input.",
				color: "text-yellow-600",
				bgColor: "bg-yellow-50 border-yellow-200",
			};
		case "refusal":
			return {
				icon: <Shield className="h-4 w-4" />,
				label: "Request Refused",
				description:
					"The assistant refused to complete this request due to safety guidelines or content policies.",
				color: "text-red-600",
				bgColor: "bg-red-50 border-red-200",
			};
		default:
			return {
				icon: <AlertCircle className="h-4 w-4" />,
				label: "Unknown Stop Reason",
				description:
					"An unknown stop reason was encountered. This may indicate a system error or new feature.",
				color: "text-gray-600",
				bgColor: "bg-gray-50 border-gray-200",
			};
	}
}

export function StopReasonDetail({
	stopReason,
	stopSequence,
	className = "",
}: StopReasonDetailProps) {
	const config = getStopReasonConfigForDetail(stopReason, stopSequence);

	return (
		<div className={`border rounded-lg p-3 ${config.bgColor} ${className}`}>
			<div className="flex items-start gap-3">
				<div className={`${config.color} mt-0.5`}>{config.icon}</div>
				<div className="flex-1 min-w-0">
					<h4 className={`text-sm font-medium ${config.color} mb-1`}>
						{config.label}
					</h4>
					<p className="text-sm text-gray-700 leading-relaxed">
						{config.description}
					</p>
					{stopSequence && stopReason === "stop_sequence" && (
						<div className="mt-2 text-xs font-mono bg-white/60 px-2 py-1 rounded border">
							Sequence: "{stopSequence}"
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
