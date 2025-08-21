# PokéCode CLI

A robust CLI tool for running PokéCode development servers locally.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @pokecode/cli
```

### Local Installation

```bash
npm install @pokecode/cli
npx pokecode --help
```

## Usage

### Start Server

```bash
# Start in foreground (development)
pokecode serve

# Start as daemon (production)
pokecode serve --daemon

# Custom port and host
pokecode serve --port 8080 --host localhost

# Custom data directory
pokecode serve --data-dir ~/pokecode-data
```

### Daemon Management

```bash
# Check server status
pokecode status

# Stop daemon
pokecode stop

# Force stop daemon
pokecode stop --force

# View logs
pokecode logs

# Follow logs in real-time
pokecode logs --follow

# Show last 100 lines
pokecode logs --lines 100

```

### Configuration

```bash
# Initialize configuration file
pokecode config --init

# Show current configuration
pokecode config --show

# Edit configuration file
pokecode config --edit
```

## Configuration

Configuration can be provided via:

1. **Configuration file**: `~/.config/pokecode/config.json` (Unix) or `%APPDATA%/pokecode/config.json` (Windows)
2. **Environment variables**: All options can be set via `POKECODE_*` variables
3. **Command line arguments**: Override any setting

### Configuration Options

```json
{
  "port": 3001,
  "host": "0.0.0.0",
  "dataDir": "~/.config/pokecode/data",
  "logLevel": "info",
  "cors": true,
  "helmet": true
}
```

### Environment Variables

- `POKECODE_PORT` - Server port (default: 3001)
- `POKECODE_HOST` - Server host (default: 0.0.0.0)
- `POKECODE_DATA_DIR` - Data directory path
- `POKECODE_LOG_LEVEL` - Log level (trace, debug, info, warn, error)
- `POKECODE_CORS` - Enable CORS (true/false)
- `POKECODE_HELMET` - Enable Helmet security (true/false)

## Development

```bash
# Build the CLI
bun run build

# Watch mode
bun run dev

# Type checking
bun run typecheck
```

## Features

- ✅ **Cross-platform**: Works on Windows, macOS, and Linux
- ✅ **Daemon mode**: Run server in background with proper process management
- ✅ **Robust logging**: Structured logging with multiple levels
- ✅ **Configuration management**: File-based config with environment override
- ✅ **Health monitoring**: Built-in health checks and status reporting
- ✅ **Graceful shutdown**: Proper cleanup on termination signals
- ✅ **Single binary**: Built with Bun compile for simple installs

## Architecture

The CLI uses a bundled architecture to avoid dependency resolution issues in global installations:

- **CLI package**: Self-contained with all dependencies bundled
- **Server entry**: Standalone server process that can be spawned
- **Daemon management**: Cross-platform process management with PID files
- **Configuration system**: Hierarchical config loading (file → env → args)

## Troubleshooting

### Server won't start

1. Check if another process is using the port:
   ```bash
   pokecode status
   ```

2. Try a different port:
   ```bash
   pokecode serve --port 3002
   ```

3. Check logs for errors:
   ```bash
   pokecode logs
   ```

### Daemon management issues

1. Clean up stale processes:
   ```bash
   pokecode stop --force
   ```

2. Check daemon status:
   ```bash
   pokecode status
   ```

3. Manually clean up:
   ```bash
   # Remove config directory (will reset everything)
   rm -rf ~/.config/pokecode  # Unix
   # or
   rmdir /s %APPDATA%\pokecode  # Windows
   ```

## License

MIT
