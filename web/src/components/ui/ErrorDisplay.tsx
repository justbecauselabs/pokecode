import { AlertCircle, AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "./Badge";
import { Card, CardContent } from "./Card";

interface ErrorDisplayProps {
	content: string;
	severity?: "error" | "warning" | "info";
	className?: string;
}

export function ErrorDisplay({
	content,
	severity = "error",
	className,
}: ErrorDisplayProps) {
	const getSeverityConfig = () => {
		switch (severity) {
			case "error":
				return {
					icon: X,
					borderColor: "border-l-red-500",
					bgColor: "bg-red-50/50 dark:bg-red-950/20",
					iconBg: "bg-red-100 dark:bg-red-900/50",
					iconColor: "text-red-600 dark:text-red-400",
					badgeColor:
						"bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
					textColor: "text-red-700 dark:text-red-300",
					label: "Error",
				};
			case "warning":
				return {
					icon: AlertTriangle,
					borderColor: "border-l-yellow-500",
					bgColor: "bg-yellow-50/50 dark:bg-yellow-950/20",
					iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
					iconColor: "text-yellow-600 dark:text-yellow-400",
					badgeColor:
						"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
					textColor: "text-yellow-700 dark:text-yellow-300",
					label: "Warning",
				};
			case "info":
				return {
					icon: AlertCircle,
					borderColor: "border-l-blue-500",
					bgColor: "bg-blue-50/50 dark:bg-blue-950/20",
					iconBg: "bg-blue-100 dark:bg-blue-900/50",
					iconColor: "text-blue-600 dark:text-blue-400",
					badgeColor:
						"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
					textColor: "text-blue-700 dark:text-blue-300",
					label: "Info",
				};
		}
	};

	const parseErrorContent = (content: string) => {
		// Remove emoji and extract meaningful error message
		const cleanContent = content
			.replace(/[\u274C\u26A0\uFE0F\u2139\uFE0F]/g, "")
			.trim();

		// Try to extract error type and message
		const errorMatch = cleanContent.match(/^(Error|Warning|Info):\s*(.+)$/);
		if (errorMatch) {
			return {
				type: errorMatch[1],
				message: errorMatch[2],
			};
		}

		// Try to extract from common patterns
		const failedMatch = cleanContent.match(/^Failed:\s*(.+)$/);
		if (failedMatch) {
			return {
				type: "Error",
				message: failedMatch[1],
			};
		}

		return {
			type: null,
			message: cleanContent,
		};
	};

	const config = getSeverityConfig();
	const ErrorIcon = config.icon;
	const errorInfo = parseErrorContent(content);

	return (
		<Card
			className={cn(
				"border-l-4",
				config.borderColor,
				config.bgColor,
				className,
			)}
		>
			<CardContent className="p-3">
				<div className="flex items-start gap-3">
					<div className="flex-shrink-0 mt-0.5">
						<div
							className={cn(
								"w-8 h-8 rounded-full flex items-center justify-center",
								config.iconBg,
							)}
						>
							<ErrorIcon className={cn("h-4 w-4", config.iconColor)} />
						</div>
					</div>

					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<Badge className={cn("text-xs", config.badgeColor)}>
								{errorInfo.type || config.label}
							</Badge>
						</div>

						<div className={cn("text-sm", config.textColor)}>
							{errorInfo.message}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
