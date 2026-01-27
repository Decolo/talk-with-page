# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Bridge is a local-first WebSocket bridge connecting a Chrome extension to Claude AI with filesystem access. It uses a pnpm monorepo with three packages.

## Commands

```bash
# Install dependencies
pnpm install

# Development (run in separate terminals)
pnpm dev:server      # WebSocket server with hot reload (tsx)
pnpm dev:extension   # Extension with watch mode (vite)

# CLI Usage (after building)
talk-with-page                           # Start server with default config
talk-with-page --port 8888               # Custom port
talk-with-page --token sk-ant-xxx        # Custom token
talk-with-page --base-url https://...   # Custom API endpoint
talk-with-page --help                    # Show help
talk-with-page --version                 # Show version

# Build
pnpm build                                    # Build all packages
pnpm --filter @claude-bridge/server build     # Server only
pnpm --filter @claude-bridge/extension build  # Extension only

# Global Installation
pnpm --filter @claude-bridge/server build
npm install -g packages/server
# Then use: talk-with-page

# Testing
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode for all packages
pnpm test:ui                 # Open Vitest UI
pnpm test:coverage           # Generate coverage reports

# Package-specific tests
pnpm --filter @claude-bridge/server test
pnpm --filter @claude-bridge/extension test

# Clean rebuild
rm -rf packages/*/dist && pnpm build
```

## Architecture

```
Chrome Extension ←──WebSocket:9999──→ Local Server ←──API──→ Claude AI
(packages/extension)                  (packages/server)      (@anthropic-ai/claude-agent-sdk)
```

**Three packages:**
- `packages/server` - Node.js WebSocket server integrating Claude Agent SDK with tools (Bash, Read, Write, Glob, Edit)
- `packages/extension` - Chrome Manifest V3 extension with popup UI, side panel, offscreen document for WebSocket, and content scripts for DOM interaction
- `packages/shared` - TypeScript types for the WebSocket protocol (`ClientMessage`, `StreamMessage`)

**Key entry points:**
- Server: `packages/server/src/index.ts` (WebSocket server), `packages/server/src/agent.ts` (Claude Agent SDK integration)
- Extension:
  - `packages/extension/src/background/service-worker.ts` - Service worker that manages offscreen document and message routing
  - `packages/extension/src/offscreen/offscreen.ts` - Offscreen document that maintains persistent WebSocket connection
  - `packages/extension/src/popup/popup.ts` - Popup UI controller
  - `packages/extension/src/side-panel/side-panel.ts` - Side panel UI for extended chat interface
  - `packages/extension/src/content/content-script.ts` - Content script for page interaction
  - `packages/extension/src/content/element-picker.ts` - Interactive element picker with overlay
  - `packages/extension/src/content/page-parser.ts` - Page content parsing utilities

## Extension Architecture Details

**WebSocket Connection Pattern:**
The extension uses Chrome's offscreen document API to maintain a persistent WebSocket connection:
1. Service worker creates and manages an offscreen document (`offscreen/offscreen.ts`)
2. Offscreen document maintains the actual WebSocket connection to `ws://127.0.0.1:9999`
3. Service worker forwards messages between popup/side-panel/content scripts and the offscreen document
4. This pattern works around Manifest V3's service worker lifecycle limitations

**Message Flow:**
- Popup/Side Panel → Service Worker → Offscreen Document → WebSocket → Server → Claude AI
- Claude AI → Server → WebSocket → Offscreen Document → Service Worker → Popup/Side Panel

**Content Scripts:**
- `content-script.ts` handles page content extraction and element selection
- `element-picker.ts` provides visual overlay for interactive element selection
- `page-parser.ts` uses @mozilla/readability for article extraction

## Code Conventions

- TypeScript with strict mode
- ESM imports; in server use `.js` extensions for local imports (e.g., `import { x } from "./y.js"`)
- Message protocol defined in `packages/shared/src/types.ts`
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Testing with Vitest (happy-dom environment for extension tests)

## Configuration

The server loads configuration with the following priority (highest to lowest):

1. **CLI arguments** - `--port`, `--token`, `--base-url`
2. **Claude settings** - `~/.claude/settings.json` (env object)
3. **Local .env file** - `packages/server/.env`
4. **Defaults** - port: 9999, host: 127.0.0.1

**Claude Settings Format** (`~/.claude/settings.json`):
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-xxx",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

**Local .env file** (`packages/server/.env`):
```env
ANTHROPIC_AUTH_TOKEN=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
WS_PORT=9999
```

**Configuration Examples:**
```bash
# Use settings from ~/.claude/settings.json
talk-with-page

# Override port via CLI
talk-with-page --port 8888

# Override token and base URL
talk-with-page --token sk-ant-xxx --base-url https://custom.api.com

# Mix: port from CLI, token from settings.json
talk-with-page --port 8888
```

## Loading the Extension

1. Build: `pnpm dev:extension` (watch mode) or `pnpm build` (production)
2. Open `chrome://extensions/`, enable Developer mode
3. Load unpacked from `packages/extension/dist/`
4. Extension includes popup, side panel, and content scripts

## Build System

**Extension (Vite):**
- Multi-entry build: service-worker, content-script, popup, offscreen, side-panel
- Custom plugin copies manifest.json, HTML/CSS files, and assets to dist/
- Watch mode rebuilds on file changes

**Server (TypeScript):**
- Compiled with tsc to dist/
- Development uses tsx for hot reload
