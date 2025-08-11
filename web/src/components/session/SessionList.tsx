import { Clock, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { Button } from "../ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/Card";
import { Input } from "../ui/Input";
import { CreateSessionModal } from "./CreateSessionModal";
import { SessionCard } from "./SessionCard";

interface SessionListProps {
	onSessionSelect: (sessionId: string) => void;
}

export function SessionList({ onSessionSelect }: SessionListProps) {
	const {
		sessions,
		recentSessions,
		isLoading,
		error,
		loadSessions,
		deleteSession,
		clearError,
	} = useSessionStore();

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "active" | "recent">("recent");

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	const filteredSessions = () => {
		let sessionList = filter === "recent" ? recentSessions : sessions;

		if (filter === "active") {
			sessionList = sessions.filter((s) => s.status === "active");
		}

		if (searchQuery) {
			sessionList = sessionList.filter(
				(session) =>
					session.projectPath
						.toLowerCase()
						.includes(searchQuery.toLowerCase()) ||
					session.context?.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		return sessionList;
	};

	const handleCreateSuccess = (sessionId: string) => {
		onSessionSelect(sessionId);
	};

	const handleDeleteSession = async (sessionId: string) => {
		if (confirm("Are you sure you want to delete this session?")) {
			try {
				await deleteSession(sessionId);
			} catch {
				// Error is handled by the store
			}
		}
	};

	if (isLoading && sessions.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading sessions...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Sessions</h1>
					<p className="text-muted-foreground">
						Manage your coding sessions
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button onClick={() => setIsCreateModalOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Session
					</Button>
				</div>
			</div>

			{error && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<p className="text-destructive text-sm">{error}</p>
						<Button
							variant="outline"
							size="sm"
							onClick={clearError}
							className="mt-2"
						>
							Dismiss
						</Button>
					</CardContent>
				</Card>
			)}

			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search sessions..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="flex gap-2">
					{(["recent", "all", "active"] as const).map((filterType) => (
						<Button
							key={filterType}
							variant={filter === filterType ? "default" : "outline"}
							size="sm"
							onClick={() => setFilter(filterType)}
						>
							{filterType === "recent" && <Clock className="h-4 w-4 mr-1" />}
							{filterType.charAt(0).toUpperCase() + filterType.slice(1)}
						</Button>
					))}
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filteredSessions().map((session) => (
					<SessionCard
						key={session.id}
						session={session}
						onSelect={onSessionSelect}
						onDelete={handleDeleteSession}
					/>
				))}
			</div>

			{filteredSessions().length === 0 && !isLoading && (
				<Card>
					<CardHeader className="text-center">
						<CardTitle className="text-lg">
							{searchQuery ? "No sessions found" : "No sessions yet"}
						</CardTitle>
						<CardDescription>
							{searchQuery
								? "Try adjusting your search query or filters"
								: "Create your first session to get started with Claude Code"}
						</CardDescription>
					</CardHeader>
					{!searchQuery && (
						<CardContent className="text-center">
							<Button onClick={() => setIsCreateModalOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create Your First Session
							</Button>
						</CardContent>
					)}
				</Card>
			)}

			<CreateSessionModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={handleCreateSuccess}
			/>
		</div>
	);
}
