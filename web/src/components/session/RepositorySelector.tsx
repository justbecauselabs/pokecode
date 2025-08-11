import { Folder, FolderGit, GitBranch, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiService } from "../../services/api";
import type { Repository } from "../../types/repository";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface RepositorySelectorProps {
	value: string;
	onChange: (folderName: string) => void;
	disabled?: boolean;
}

export function RepositorySelector({
	value,
	onChange,
	disabled,
}: RepositorySelectorProps) {
	const [repositories, setRepositories] = useState<Repository[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [githubReposDirectory, setGithubReposDirectory] = useState<string>("");

	const loadRepositories = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await apiService.listRepositories();
			setRepositories(response.repositories);
			setGithubReposDirectory(response.githubReposDirectory);
		} catch (err: unknown) {
			setError(
				(err as { response?: { data?: { error?: string } } }).response?.data
					?.error || "Failed to load repositories",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadRepositories();
	}, []);

	const handleRepositorySelect = (folderName: string) => {
		onChange(folderName);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
				<span className="ml-2 text-sm text-muted-foreground">
					Loading repositories...
				</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-3">
				<div className="text-sm text-destructive">{error}</div>
				<Button
					type="button"
					variant="outline"
					onClick={loadRepositories}
					disabled={disabled}
					size="sm"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Retry
				</Button>
			</div>
		);
	}

	if (repositories.length === 0) {
		return (
			<div className="space-y-3">
				<div className="text-center py-6 text-muted-foreground">
					<Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
					<p className="text-sm">No repositories found</p>
					<p className="text-xs mt-1">
						Add git repositories to{" "}
						<code className="bg-muted px-1 rounded">
							{githubReposDirectory}
						</code>
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={loadRepositories}
					disabled={disabled}
					size="sm"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Select a repository from{" "}
					<code className="bg-muted px-1 rounded text-xs">
						{githubReposDirectory}
					</code>
				</p>
				<Button
					type="button"
					variant="ghost"
					onClick={loadRepositories}
					disabled={disabled || isLoading}
					size="sm"
				>
					<RefreshCw className="h-4 w-4" />
				</Button>
			</div>

			<div className="max-h-64 overflow-y-auto space-y-2">
				{repositories.map((repo) => (
					<Card
						key={repo.folderName}
						className={`p-3 cursor-pointer transition-colors border-2 ${
							value === repo.folderName
								? "border-primary bg-primary/5"
								: "border-border hover:border-primary/50"
						} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
						onClick={() => !disabled && handleRepositorySelect(repo.folderName)}
					>
						<div className="flex items-center space-x-3">
							<div className="flex-shrink-0">
								{repo.isGitRepository ? (
									<FolderGit className="h-5 w-5 text-green-600" />
								) : (
									<Folder className="h-5 w-5 text-muted-foreground" />
								)}
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-medium text-sm truncate">
									{repo.folderName}
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{repo.path}
								</p>
							</div>
							<div className="flex-shrink-0">
								{repo.isGitRepository ? (
									<Badge variant="secondary" className="text-xs">
										<GitBranch className="h-3 w-3 mr-1" />
										Git
									</Badge>
								) : (
									<Badge variant="outline" className="text-xs">
										Folder
									</Badge>
								)}
							</div>
						</div>
					</Card>
				))}
			</div>

			{value && (
				<div className="text-xs text-muted-foreground">
					Selected: <code className="bg-muted px-1 rounded">{value}</code>
				</div>
			)}
		</div>
	);
}
