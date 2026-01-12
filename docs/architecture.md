# Architecture Documentation

## Overview

Claude Code Bridge is a **local-first WebSocket bridge** that connects Chrome browser to Claude AI with filesystem access. It uses a monorepo structure with shared TypeScript types for type-safe communication.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     MONOREPO STRUCTURE                       │
│                  (pnpm workspace based)                      │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐           ┌──────────────┐           ┌─────────────┐
│  Chrome Browser │           │   Local PC   │           │  Claude AI  │
│                 │           │              │           │   (API)     │
└─────────────────┘           └──────────────┘           └─────────────┘
        │                             │                         │
        │                             │                         │
   [Extension]                   [Server]                  [Agent SDK]
        │                             │                         │
        ▼                             ▼                         ▼
┌─────────────────┐           ┌──────────────┐           ┌─────────────┐
│   packages/     │  WS 9999  │  packages/   │    API    │  Anthropic  │
│   extension/    │◄─────────►│  server/     │◄─────────►│   Servers   │
│                 │           │              │   HTTPS   │             │
│  - Popup UI     │           │  - WS Server │           │  - Claude   │
│  - Service Wkr  │           │  - Agent SDK │           │  - Models   │
│  - Content Scr  │           │  - Tools     │           │  - Tokens   │
└─────────────────┘           └──────────────┘           └─────────────┘
        │                             │
        └──────── packages/shared ────┘
                (TypeScript Types)
```

## Project Structure

```
cloud-code-reviewer/
├── docs/                          # Documentation
│   ├── README.md
│   ├── architecture.md
│   ├── components.md
│   ├── data-flow.md
│   └── development.md
│
├── packages/
│   ├── extension/                 # Chrome Extension (Manifest V3)
│   │   ├── src/
│   │   │   ├── background/
│   │   │   │   └── service-worker.ts    # WebSocket client
│   │   │   ├── content/
│   │   │   │   ├── content-script.ts    # Page interaction
│   │   │   │   ├── element-picker.ts    # Element selector
│   │   │   │   └── element-picker.css
│   │   │   └── popup/
│   │   │       └── popup.ts             # UI controller
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   └── popup.css
│   │   ├── assets/icons/
│   │   ├── manifest.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── server/                    # WebSocket Server
│   │   ├── src/
│   │   │   ├── index.ts           # Server entry point
│   │   │   ├── agent.ts           # Claude Agent SDK
│   │   │   └── types.ts           # Type exports
│   │   ├── .env                   # API credentials (gitignored)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                    # Shared Types
│       ├── src/
│       │   └── types.ts
│       └── package.json
│
├── package.json                   # Workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .gitignore
├── .env.example
└── README.md
```

## Design Patterns

### 1. Monorepo with Workspaces

**Pattern**: Multiple related packages in a single repository
**Implementation**: pnpm workspaces
**Benefits**:
- Shared dependencies
- Coordinated versioning
- Single build/test/deploy pipeline
- Type sharing without publishing

**Configuration**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

### 2. Shared Type System

**Pattern**: Single source of truth for data contracts
**Implementation**: `@claude-bridge/shared` package
**Benefits**:
- Compile-time type safety
- No duplicate type definitions
- Protocol changes validated across codebase
- IDE autocomplete for messages

**Usage**:
```typescript
// Both extension and server import from shared
import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';
```

### 3. WebSocket Pub/Sub

**Pattern**: Bidirectional real-time communication
**Implementation**: WebSocket on localhost:9999
**Benefits**:
- Low latency (< 5ms)
- Server push (streaming responses)
- Persistent connection
- No CORS issues (localhost)

**Flow**:
```
Extension → ClientMessage → Server → Claude API
Extension ← StreamMessage ← Server ← Claude API (streamed)
```

### 4. Service Worker Hub

**Pattern**: Central message router
**Implementation**: Chrome Extension Service Worker
**Benefits**:
- Persistent WebSocket connection
- Routes messages between popup/content/server
- Stores message history
- Handles reconnection

**Routing**:
```
Popup → chrome.runtime.sendMessage → Service Worker → WebSocket
Content Script → chrome.runtime.sendMessage → Service Worker → WebSocket
```

### 5. Content Script Injection

**Pattern**: DOM access layer
**Implementation**: Manifest V3 content scripts
**Benefits**:
- Access to page DOM
- Can read/modify webpage
- Isolated from page scripts
- Inject UI overlays

**Injection**:
```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content/content-script.js"],
  "run_at": "document_idle"
}]
```

### 6. Agent SDK Integration

**Pattern**: AI agent with tools
**Implementation**: `@anthropic-ai/claude-agent-sdk`
**Benefits**:
- Built-in tools (Bash, Read, Write, Glob, Edit)
- Streaming responses
- Tool execution handling
- Message protocol

**Tools Available**:
- `Bash` - Execute shell commands
- `Read` - Read files
- `Write` - Write files
- `Glob` - Find files by pattern
- `Edit` - Edit file contents

## Security Model

### Extension Permissions

```json
{
  "permissions": [
    "activeTab",    // Access current tab when popup open
    "storage",      // Local storage for history
    "scripting"     // Inject scripts
  ],
  "host_permissions": [
    "<all_urls>"    // Access any webpage for content extraction
  ]
}
```

### Network Isolation

- **Server**: Binds to `127.0.0.1` only (not `0.0.0.0`)
- **Port**: 9999 (not exposed to network)
- **WebSocket**: localhost-only, no external access
- **API Key**: Stored in `.env` (gitignored)

### Content Security

- Extension cannot access filesystem directly
- Server provides controlled filesystem access via Claude tools
- User prompt required for sensitive operations
- All file operations logged

## Performance Characteristics

### Server
- **Startup Time**: < 1 second
- **Memory Usage**: ~50MB (Node.js + dependencies)
- **WebSocket Latency**: 1-5ms (localhost)
- **Concurrent Clients**: Multiple extensions supported
- **API Timeout**: 3000 seconds (configurable)

### Extension
- **Bundle Size**: ~50KB (compiled TypeScript)
- **Memory Usage**: ~10MB (service worker + popup)
- **DOM Parsing**: < 100ms for typical pages
- **Message History**: Last 100 messages cached
- **Reconnect Strategy**: Exponential backoff (max 30s)

### Claude API
- **Streaming**: Real-time token-by-token
- **Model**: Claude Sonnet (configurable)
- **Context Window**: Large (depends on model)
- **Tool Execution**: Sequential (Bash → Read → etc.)

## Scalability Considerations

### Current Design
- **Scope**: Single-user workstation tool
- **Deployment**: Local development environment
- **Concurrency**: Limited by Claude API rate limits
- **Storage**: In-memory (message history)

### Potential Enhancements
- Add persistent storage (SQLite)
- Support multiple Claude instances
- Add request queuing
- Implement session management
- Add authentication layer

## Technology Choices

### Why pnpm?
- Faster than npm/yarn
- Efficient disk usage (symlinks)
- Strict dependency resolution
- Native workspace support

### Why WebSocket?
- Bidirectional communication
- Low latency
- Server push capability
- Streaming support
- No polling overhead

### Why Manifest V3?
- Google mandate (MV2 deprecated)
- Better security model
- Service workers (vs background pages)
- Future-proof

### Why Vite?
- Fast build times
- HMR for development
- TypeScript support
- Modern bundler
- Simple configuration

### Why Localhost Server?
- Filesystem access
- No CORS issues
- Security (not exposed to internet)
- Full Node.js environment
- Use Claude Agent SDK

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Monorepo | Easier to maintain related packages together |
| WebSocket | Real-time bidirectional streaming |
| Manifest V3 | Future-proof, Google requirement |
| Service Worker | Persistent connection vs background page |
| Local Server | Security, filesystem access, Claude SDK |
| Shared Types | Type safety across boundaries |
| Element Picker | Better UX than manual copy/paste |
| Streaming | Real-time feedback vs batch response |
| TypeScript | Type safety, better DX |
| Vite | Fast builds, modern tooling |

## Comparison to Alternatives

### vs Direct API Integration
- ❌ No filesystem access
- ❌ CORS limitations
- ❌ No built-in tools
- ✅ Simpler architecture

### vs Claude Desktop App
- ✅ Works in browser
- ✅ Access to DOM
- ✅ Pick elements interactively
- ❌ Requires local server

### vs Browser-Only Extension
- ❌ Can't access filesystem
- ❌ Limited tool execution
- ❌ No backend processing
- ✅ Easier deployment

## Future Architecture Considerations

### Potential Improvements
1. **Add Database**: SQLite for persistent history
2. **Multi-Model Support**: Switch between Claude models
3. **Plugin System**: Custom tools/handlers
4. **Cloud Sync**: Optional cloud storage
5. **Multi-User**: Authentication layer
6. **Distributed**: Multiple server instances

### Migration Paths
- **To Cloud**: Add authentication, deploy server
- **To Mobile**: React Native wrapper
- **To Desktop**: Electron wrapper
- **To API**: REST/GraphQL layer

## Conclusion

The architecture is designed for:
- **Simplicity**: Easy to understand and modify
- **Security**: Local-first, no external exposure
- **Performance**: Fast local communication
- **Extensibility**: Easy to add features
- **Type Safety**: Compile-time validation
- **Developer Experience**: Modern tooling, fast builds
