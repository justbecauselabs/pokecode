import { X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import type { CreateSessionData } from "../../types/session";
import { Button } from "../ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/Card";
import { Input } from "../ui/Input";
import { RepositorySelector } from "./RepositorySelector";

interface CreateSessionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (sessionId: string) => void;
}

export function CreateSessionModal({
	isOpen,
	onClose,
	onSuccess,
}: CreateSessionModalProps) {
	const { createSession, isLoading, error, clearError } = useSessionStore();
	const [formData, setFormData] = useState<CreateSessionData>({
		folderName: "",
		context: "",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();

		if (!formData.folderName?.trim()) {
			return;
		}

		try {
			const session = await createSession({
				folderName: formData.folderName.trim(),
				context: formData.context?.trim() || undefined,
			});
			onSuccess(session.id);
			onClose();
			setFormData({ folderName: "", context: "" });
		} catch {
			// Error is handled by the store
		}
	};

	const handleClose = () => {
		onClose();
		clearError();
		setFormData({ folderName: "", context: "" });
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
			<div
				className="w-full max-w-lg rounded-xl shadow-2xl"
				style={{
					backgroundColor: "#ffffff",
					border: "1px solid #e5e7eb",
					color: "#000000",
				}}
			>
				<Card className="border-none bg-transparent shadow-none text-inherit">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Create New Session</CardTitle>
								<CardDescription>
									Select a repository and start coding with Claude
								</CardDescription>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleClose}
								disabled={isLoading}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">
									Select Repository *
								</label>
								<RepositorySelector
									value={formData.folderName || ""}
									onChange={(folderName) =>
										setFormData((prev) => ({ ...prev, folderName }))
									}
									disabled={isLoading}
								/>
							</div>
							<div className="space-y-2">
								<label htmlFor="context" className="text-sm font-medium">
									Context (optional)
								</label>
								<Input
									id="context"
									name="context"
									type="text"
									value={formData.context}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											context: e.target.value,
										}))
									}
									placeholder="Describe what you're working on..."
									disabled={isLoading}
									maxLength={500}
								/>
								<p className="text-xs text-muted-foreground">
									Add context to help Claude understand what you're working on
								</p>
							</div>
							{error && <div className="text-sm text-destructive">{error}</div>}
							<div className="flex gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleClose}
									disabled={isLoading}
									className="flex-1"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={isLoading || !formData.folderName?.trim()}
									className="flex-1"
								>
									{isLoading ? "Creating..." : "Create Session"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
