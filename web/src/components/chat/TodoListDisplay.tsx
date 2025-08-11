import { CheckCircle, Circle, Clock } from "lucide-react";
import type { TodoList } from "../../types/chat";
import { Badge } from "../ui/Badge";
import { Card, CardContent, CardHeader } from "../ui/Card";

interface TodoListDisplayProps {
	todos: TodoList;
}

export function TodoListDisplay({ todos }: TodoListDisplayProps) {
	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="h-4 w-4" />;
			case "in_progress":
				return <Clock className="h-4 w-4" />;
			case "pending":
				return <Circle className="h-4 w-4" />;
			default:
				return <Circle className="h-4 w-4" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-100 text-green-800 border-green-200";
			case "in_progress":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "pending":
				return "bg-gray-100 text-gray-800 border-gray-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const completedCount = todos.todos.filter(
		(todo) => todo.status === "completed",
	).length;
	const totalCount = todos.todos.length;

	return (
		<Card className="border-l-4 border-l-blue-500">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<CheckCircle className="h-5 w-5 text-blue-600" />
						<span className="font-semibold text-blue-900">TODO List</span>
					</div>
					<Badge variant="outline" className="text-xs">
						{completedCount}/{totalCount} completed
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{todos.todos.map((todo) => (
					<div
						key={todo.id}
						className="flex items-start gap-3 p-2 rounded-md border bg-card/50"
					>
						<div className="flex-shrink-0 mt-0.5">
							{getStatusIcon(todo.status)}
						</div>
						<div className="flex-1 min-w-0">
							<div
								className={`text-sm leading-relaxed ${
									todo.status === "completed"
										? "text-muted-foreground line-through"
										: "text-foreground"
								}`}
							>
								{todo.content}
							</div>
						</div>
						<Badge
							variant="outline"
							className={`${getStatusColor(todo.status)} text-xs flex-shrink-0`}
						>
							{todo.status.replace("_", " ")}
						</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
