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

# Build
pnpm build                                    # Build all packages
pnpm --filter @claude-bridge/server build     # Server only
pnpm --filter @claude-bridge/extension build  # Extension only

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
- `packages/extension` - Chrome Manifest V3 extension (popup UI, service worker for WebSocket, content scripts for DOM)
- `packages/shared` - TypeScript types for the WebSocket protocol (`ClientMessage`, `StreamMessage`)

**Key entry points:**
- Server: `packages/server/src/index.ts` (WebSocket), `packages/server/src/agent.ts` (Claude Agent)
- Extension: `packages/extension/src/background/service-worker.ts` (WebSocket client hub), `packages/extension/src/popup/popup.ts` (UI)
- Content scripts: `packages/extension/src/content/content-script.ts`, `element-picker.ts`

## Code Conventions

- TypeScript with strict mode
- ESM imports; in server use `.js` extensions for local imports (e.g., `import { x } from "./y.js"`)
- Message protocol defined in `packages/shared/src/types.ts`
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`

## Environment Setup

Create `packages/server/.env`:
```env
ANTHROPIC_AUTH_TOKEN=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
WS_PORT=9999
```

## Loading the Extension

1. Run `pnpm dev:extension` or `pnpm build`
2. Open `chrome://extensions/`, enable Developer mode
3. Load unpacked from `packages/extension/dist/`
