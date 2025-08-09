/**
 * Main Ink application component
 */

import React from 'react';
import { render } from 'ink';
import { ChatScreen } from './components/ChatScreen';
import type { Session } from './types/api';

interface AppProps {
  session: Session;
}

const App: React.FC<AppProps> = ({ session }) => {
  return <ChatScreen session={session} />;
};

/**
 * Launch the Ink chat interface
 */
export function launchChatInterface(session: Session): void {
  const app = render(<App session={session} />);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    app.unmount();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    app.unmount();
    process.exit(0);
  });
}