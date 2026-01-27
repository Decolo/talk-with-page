# Claude Code Bridge

WebSocket server + Chrome extension that connects any web page to Claude AI with file system access.

## 📖 Documentation

Comprehensive documentation is available in the [`/docs`](./docs) directory:

- **[Architecture](./docs/architecture.md)** - System design, patterns, and technical overview
- **[Components](./docs/components.md)** - Detailed component specifications
- **[Data Flow](./docs/data-flow.md)** - Message flow and interaction examples
- **[Development Guide](./docs/development.md)** - Setup, build, testing, and deployment

Quick links:
- [Quick Start](#quick-start) (below)
- [Testing Guide](#testing)
- [Troubleshooting](#troubleshooting)

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────┐     Agent SDK      ┌─────────┐
│ Chrome Extension│ ◄─────────────────►│ Local Server │ ◄─────────────────►│ Claude  │
│ (packages/ext)  │   localhost:9999   │ (packages/   │  API w/ tools      │   AI    │
└─────────────────┘                    │  server)     │                    └─────────┘
```

## Project Structure

```
cloud-code-reviewer/
├── packages/
│   ├── server/          # WebSocket server
│   │   ├── src/
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── agent.ts        # Claude Agent SDK integration
│   │   │   └── types.ts        # Type definitions
│   │   └── .env               # API credentials
│   │
│   ├── extension/       # Chrome extension (Manifest V3)
│   │   ├── src/
│   │   │   ├── background/
│   │   │   │   └── service-worker.ts    # WebSocket client
│   │   │   ├── content/
│   │   │   │   ├── content-script.ts    # Page interaction
│   │   │   │   └── element-picker.ts    # Element selector
│   │   │   └── popup/
│   │   │       └── popup.ts             # UI controller
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   └── popup.css
│   │   ├── manifest.json
│   │   └── dist/              # Built extension (load this in Chrome)
│   │
│   └── shared/          # Shared types
│       └── src/types.ts
│
├── package.json          # Workspace root
└── pnpm-workspace.yaml
```

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure API Credentials

**Option A: Use Claude Code settings (Recommended)**

If you have Claude Code installed, the server will automatically use credentials from `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-xxx",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  }
}
```

**Option B: Use local .env file**

Create `packages/server/.env`:

```env
ANTHROPIC_AUTH_TOKEN=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com
WS_PORT=9999
```

**Option C: Use CLI arguments**

```bash
talk-with-page --token sk-ant-xxx --base-url https://api.anthropic.com
```

### 3. Start the Server

```bash
# Development mode
pnpm dev:server

# Or build and use CLI
pnpm --filter @claude-bridge/server build
npm install -g packages/server
talk-with-page
```

Server runs on `ws://127.0.0.1:9999`

### 4. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select: `/Users/decolo/Github/talk-with-page/packages/extension/dist`
5. Extension icon appears in toolbar

### 5. Use the Extension

**Chat Tab:**
- Type commands directly to Claude
- See streaming responses in real-time
- Connection status indicator shows server connection

**Page Tab:**
- **Analyze Page**: Send full page content to Claude
- **Analyze Selection**: Send selected text
- **Pick Element**: Click any element on the page to analyze it

**Element Picker:**
- Overlay appears with highlighting
- Click any element to select it
- Automatically parses tables, lists, code blocks
- Sends structured content to Claude

## Features

### Server
- ✅ WebSocket server on localhost:9999
- ✅ Claude Agent SDK integration
- ✅ Built-in tools: Bash, Read, Write, Glob, Edit
- ✅ Streaming responses
- ✅ Custom API endpoint support
- ✅ CLI tool with global installation
- ✅ Configuration priority: CLI > Claude settings > .env > defaults

### Extension
- ✅ Manifest V3
- ✅ Real-time chat interface
- ✅ Connection status indicator
- ✅ Page content analysis
- ✅ Selection analysis
- ✅ Interactive element picker
- ✅ Smart content parsing (tables, lists, code)
- ✅ Message history
- ✅ Auto-reconnection

## Development

### Server CLI

```bash
# Development mode with hot reload
pnpm dev:server

# Build
pnpm --filter @claude-bridge/server build

# Run built version
node packages/server/dist/index.js

# CLI options
talk-with-page --help
talk-with-page --version
talk-with-page --port 8888
talk-with-page --token sk-ant-xxx
talk-with-page --base-url https://custom.api.com
```

### Build Extension

```bash
# Watch mode (rebuilds on change)
pnpm dev:extension

# Production build
pnpm --filter @claude-bridge/extension build
```

### Build Everything

```bash
pnpm build
```

## Environment Variables

The server supports multiple configuration sources with priority:

1. **CLI arguments** (highest priority)
2. **Claude Code settings** (`~/.claude/settings.json`)
3. **Local .env file** (`packages/server/.env`)
4. **Defaults** (lowest priority)

Edit `packages/server/.env` or `~/.claude/settings.json`:

```env
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_BASE_URL=https://code.aipor.cc/api
WS_PORT=9999
```

## Testing

1. Start server: `pnpm dev:server`
2. Load extension in Chrome
3. Open extension popup
4. Check connection status (green = connected)
5. Try sending a command: "List files in current directory"
6. Go to any webpage, click "Pick Element", select an element
7. Watch Claude analyze it in real-time

## Troubleshooting

**Extension not connecting:**
- Check server is running (`pnpm dev:server`)
- Check console in extension popup (F12)
- Verify port 9999 is available

**Element picker not working:**
- Refresh the webpage
- Check content script loaded (Chrome DevTools → Sources)

**Build errors:**
- Run `pnpm install` from project root
- Clear dist: `rm -rf packages/extension/dist`
- Rebuild: `pnpm --filter @claude-bridge/extension build`

## Message Protocol

**Client → Server:**
```typescript
{
  type: 'command' | 'page_content' | 'element_content',
  id: string,
  timestamp: number,
  payload: { ... }
}
```

**Server → Client (streamed):**
```typescript
{
  type: 'status' | 'text' | 'tool' | 'error' | 'done',
  requestId: string,
  content?: string,
  tool?: string,
  timestamp: number
}
```

## Tech Stack

- **Server**: Node.js, TypeScript, ws, @anthropic-ai/claude-agent-sdk
- **Extension**: TypeScript, Vite, Chrome Extension Manifest V3
- **Monorepo**: pnpm workspaces

## License

ISC
