import { render } from "@opentui/react";
import { App } from "./ui/App";

export function runDashboard(params: { serverUrl: string; mode: "attach" | "foreground" }): void {
  // Fire-and-stay-running render; OpenTUI manages the TUI event loop.
  render(<App serverUrl={params.serverUrl} mode={params.mode} />);
}

