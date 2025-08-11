import { useEffect } from "react";
import {
	Navigate,
	Route,
	BrowserRouter as Router,
	Routes,
} from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { HomePage } from "./pages/HomePage";
import { useSessionStore } from "./stores/sessionStore";

export function App() {
	const { loadSessions } = useSessionStore();

	// Load sessions on app initialization to support direct navigation to chat URLs
	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	return (
		<Router>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/chat/:sessionId" element={<ChatPage />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Router>
	);
}

export default App;
