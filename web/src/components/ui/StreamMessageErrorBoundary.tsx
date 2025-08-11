import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card, CardContent, CardHeader } from "./Card";

interface Props {
	children: ReactNode;
	messageId?: string;
	messageType?: string;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: ErrorInfo;
}

export class StreamMessageErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({
			error,
			errorInfo,
		});

		console.error("StreamMessage Error Boundary caught an error:", {
			error,
			errorInfo,
			messageId: this.props.messageId,
			messageType: this.props.messageType,
		});
	}

	handleRetry = () => {
		this.setState({ hasError: false, error: undefined, errorInfo: undefined });
	};

	render() {
		if (this.state.hasError) {
			return (
				<Card className="border-red-200 bg-red-50">
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<Badge
								variant="outline"
								className="bg-red-100 text-red-800 border-red-200 text-xs"
							>
								<AlertTriangle className="h-3 w-3" />
								<span className="ml-1">Error</span>
							</Badge>
							<Button
								variant="ghost"
								size="sm"
								onClick={this.handleRetry}
								className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
								title="Retry rendering"
							>
								<RefreshCw className="h-3 w-3" />
							</Button>
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<div className="space-y-2">
							<div className="text-sm font-medium text-red-700">
								Failed to render stream message
							</div>
							{this.props.messageType && (
								<div className="text-xs text-red-600">
									Message Type: {this.props.messageType}
								</div>
							)}
							{this.state.error && (
								<details className="text-xs">
									<summary className="cursor-pointer text-red-600 hover:text-red-700">
										Show error details
									</summary>
									<div className="mt-2 p-2 bg-red-100 rounded font-mono text-xs">
										<div className="font-semibold">Error:</div>
										<div className="mb-2">{this.state.error.message}</div>
										{this.state.error.stack && (
											<>
												<div className="font-semibold">Stack:</div>
												<pre className="whitespace-pre-wrap text-xs">
													{this.state.error.stack}
												</pre>
											</>
										)}
									</div>
								</details>
							)}
						</div>
					</CardContent>
				</Card>
			);
		}

		return this.props.children;
	}
}
