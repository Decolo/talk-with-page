# Claude Code Bridge Documentation

Welcome to the Claude Code Bridge documentation. This project enables you to interact with Claude AI directly from any webpage through a Chrome extension connected to a local WebSocket server.

## 📚 Documentation Index

- [Architecture](./architecture.md) - Complete infrastructure and technical design
- [Components](./components.md) - Detailed component breakdown
- [Data Flow](./data-flow.md) - Message flow and interaction patterns
- [Development Guide](./development.md) - Setup, build, and deployment

## Quick Links

### For Users
- [Quick Start Guide](../README.md#quick-start)
- [Testing Guide](../README.md#testing)
- [Troubleshooting](../README.md#troubleshooting)

### For Developers
- [Project Structure](./architecture.md#project-structure)
- [Build Process](./development.md#build-process)
- [Message Protocol](./components.md#message-protocol)
- [Extension APIs](./components.md#chrome-extension)

## Project Overview

**What it does**: Connects Chrome browser to Claude AI with filesystem access through a local WebSocket server.

**Key Features**:
- Chat interface in browser popup
- Analyze webpage content
- Interactive element picker
- Real-time streaming responses
- File system access via Claude Agent SDK tools

**Architecture**:
```
Chrome Extension ←→ WebSocket Server ←→ Claude AI
  (Browser)        (localhost:9999)     (Anthropic API)
```

## Technology Stack

- **Monorepo**: pnpm workspaces
- **Server**: Node.js, TypeScript, WebSocket, Claude Agent SDK
- **Extension**: Chrome Manifest V3, TypeScript, Vite
- **Communication**: WebSocket (local) + HTTPS (Claude API)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start server
pnpm dev:server

# Build extension (in another terminal)
pnpm dev:extension

# Load extension in Chrome
# chrome://extensions/ → Load unpacked → packages/extension/dist/
```

See the [Development Guide](./development.md) for detailed instructions.
