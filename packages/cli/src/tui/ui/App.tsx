import { Box, Spacer, Text, useInput } from "@opentui/react";

export type AppProps = { serverUrl: string; mode: "attach" | "foreground" };

export function App(props: AppProps) {
  useInput((key) => {
    if (key === "q" || key === "Q") {
      // Detach in attach mode; exit in foreground for now.
      // Wiring to graceful server shutdown will be added when integrating.
      process.exit(0);
    }
  });

  return (
    <Box width="100%" height="100%" flexDirection="column" borderColor="gray">
      <Header serverUrl={props.serverUrl} />
      <Box width="100%" height="100%" flexDirection="row">
        <Box width="40%" height="100%" flexDirection="column" borderColor="gray">
          <SectionTitle title="Connected Devices (last 1h)" />
          <Box paddingX={1} paddingY={0}>
            <Text color="gray">No data yet — scaffolding view</Text>
          </Box>
        </Box>
        <Spacer />
        <Box width="60%" height="100%" flexDirection="column" borderColor="gray">
          <SectionTitle title="Active Sessions (last 1h)" />
          <Box paddingX={1} paddingY={0}>
            <Text color="gray">No data yet — scaffolding view</Text>
          </Box>
          <SectionTitle title="Live Logs" />
          <Box paddingX={1} paddingY={0}>
            <Text color="gray">Logs will stream here…</Text>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function Header(params: { serverUrl: string }) {
  return (
    <Box paddingX={1} paddingY={0}>
      <Text bold>PokéCode</Text>
      <Spacer />
      <Text color="gray">{params.serverUrl}</Text>
    </Box>
  );
}

function SectionTitle(params: { title: string }) {
  return (
    <Box paddingX={1} paddingY={0}>
      <Text bold>{params.title}</Text>
    </Box>
  );
}

function Footer() {
  return (
    <Box paddingX={1} paddingY={0}>
      <Text color="gray">q Quit  r Restart worker  s Toggle logs  f Filter  ←/→ Focus  ↑/↓ Select  p Pause</Text>
    </Box>
  );
}

