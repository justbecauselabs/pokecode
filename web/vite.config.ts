import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		host: true, // Allow external connections
		allowedHosts: [
			"localhost",
			"127.0.0.1",
			"williams-macbook-pro-1.tailaf1649.ts.net"
		],
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
