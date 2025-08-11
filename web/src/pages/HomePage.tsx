import { useNavigate } from "react-router-dom";
import { SessionList } from "../components/session/SessionList";

export function HomePage() {
	const navigate = useNavigate();

	const handleSessionSelect = (sessionId: string) => {
		navigate(`/chat/${sessionId}`);
	};

	return (
		<div className="min-h-screen bg-background">
			<SessionList onSessionSelect={handleSessionSelect} />
		</div>
	);
}
