# Development Guide

Complete guide for developing, building, and deploying Claude Code Bridge.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Build Process](#build-process)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Prerequisites

### Required Software

- **Node.js**: v18 or higher
- **pnpm**: v8 or higher (package manager)
- **Chrome**: Latest version (for extension)
- **Git**: For version control

### Installation

```bash
# Install Node.js (use nvm)
nvm install 18
nvm use 18

# Install pnpm globally
npm install -g pnpm

# Verify installations
node --version  # v18.x.x or higher
pnpm --version  # 8.x.x or higher
```

### API Credentials

You'll need an Anthropic Claude API key:

1. Sign up at https://console.anthropic.com
2. Create an API key
3. Note your key (starts with `sk-ant-`)

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/cloud-code-reviewer.git
cd cloud-code-reviewer
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This installs dependencies for:
# - Root workspace
# - packages/server
# - packages/extension
# - packages/shared
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example packages/server/.env

# Edit with your API key
nano packages/server/.env
```

**Required variables**:
```env
ANTHROPIC_AUTH_TOKEN=sk-ant-your-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
WS_PORT=9999
```

---

## Development Workflow

### Start Development Servers

You'll need **two terminal windows**:

#### Terminal 1: WebSocket Server

```bash
pnpm dev:server

# Output:
# > @claude-bridge/server@1.0.0 dev
# > tsx src/index.ts
# 🌉 Claude Code Bridge running on ws://127.0.0.1:9999
```

**What it does**:
- Starts WebSocket server on port 9999
- Watches for file changes (auto-restart with tsx)
- Connects to Claude API
- Logs all messages

#### Terminal 2: Extension Builder

```bash
pnpm dev:extension

# Output:
# > @claude-bridge/extension@1.0.0 dev
# > vite build --watch
# watching for file changes...
```

**What it does**:
- Compiles TypeScript to JavaScript
- Bundles extension files
- Outputs to `packages/extension/dist/`
- Auto-rebuilds on file changes

### Load Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select folder: `packages/extension/dist/`
6. Extension icon appears in toolbar

### Development Cycle

```bash
# 1. Make changes to code
vim packages/extension/src/popup/popup.ts

# 2. Vite auto-rebuilds (watch Terminal 2)
# watching for file changes...
# ✓ built in 234ms

# 3. Reload extension in Chrome
# Go to chrome://extensions/
# Click reload icon on your extension

# 4. Test changes
# Click extension icon, verify changes
```

---

## Build Process

### Build All Packages

```bash
# Build server + extension
pnpm build

# Output:
# @claude-bridge/server: tsc
# @claude-bridge/extension: vite build
```

### Build Individual Packages

```bash
# Build server only
pnpm --filter @claude-bridge/server build

# Build extension only
pnpm --filter @claude-bridge/extension build
```

### Build Output Locations

```
packages/
├── server/dist/              # Compiled server
│   ├── index.js
│   ├── agent.js
│   └── types.js
│
└── extension/dist/           # Bundled extension (load this in Chrome)
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content-script.js
    │   └── element-picker.css
    ├── popup/
    │   ├── popup.html
    │   ├── popup.css
    │   └── popup.js
    ├── assets/icons/
    └── manifest.json
```

### Clean Build

```bash
# Remove all build artifacts
rm -rf packages/*/dist

# Rebuild everything
pnpm build
```

---

## Testing

### Manual Testing

#### Test 1: Server Connection

```bash
# Terminal 1: Start server
pnpm dev:server

# Verify output shows:
# 🌉 Claude Code Bridge running on ws://127.0.0.1:9999
```

#### Test 2: Extension Loads

1. Load extension in Chrome
2. Check `chrome://extensions/` for errors
3. Click extension icon
4. Popup should open without errors

#### Test 3: Connection Status

1. Open extension popup
2. Connection indicator should be **green** (connected)
3. Stop server (Ctrl+C)
4. Indicator turns **red** (disconnected)
5. Restart server
6. Indicator turns **yellow** (reconnecting) then **green**

#### Test 4: Send Command

1. Open extension popup
2. Type: "List files in current directory"
3. Click **Send**
4. Should see:
   - User message appears
   - Status: "Processing..."
   - Tool: "Using tool: Bash"
   - Assistant response with file list
   - Status: "Done"

#### Test 5: Page Analysis

1. Navigate to any webpage
2. Open extension popup
3. Go to **Page** tab
4. Click **Analyze Current Page**
5. Switch to **Chat** tab
6. Should see Claude's analysis of the page

#### Test 6: Element Picker

1. Navigate to a page with a table (e.g., Wikipedia)
2. Open extension popup
3. Go to **Page** tab
4. Click **Pick Element**
5. Popup closes, overlay appears
6. Hover over table (highlight appears)
7. Click table
8. Reopen popup, see parsed table data

### Console Debugging

#### Server Logs

```bash
# Terminal running dev:server shows:
[Server] Client connected
[Server] Received: command (id: popup-1736607123456)
[Agent] Running agent with prompt: List files...
[Agent] Tool used: Bash
[Agent] Response: [file list]
```

#### Extension Console

```bash
# Open extension popup
# Right-click anywhere → Inspect
# Console tab shows:
[Service Worker] Connected to server
[Service Worker] Received: status
[Popup] Message added: user
[Popup] Message added: assistant
```

#### Content Script Console

```bash
# On any webpage with extension loaded
# F12 → Console tab
[Content Script] Message received: activatePicker
[Element Picker] Activated
[Element Picker] Element selected: table#data-table
```

---

## Deployment

### Production Build

```bash
# Create production builds
pnpm build

# Verify outputs
ls -la packages/server/dist/
ls -la packages/extension/dist/
```

### Package Extension

#### Option 1: Load Unpacked (Development)

```bash
# Already covered above
chrome://extensions/ → Load unpacked → packages/extension/dist/
```

#### Option 2: Create .zip (Distribution)

```bash
cd packages/extension
zip -r claude-bridge-extension.zip dist/

# Share claude-bridge-extension.zip
# Others can extract and load unpacked
```

#### Option 3: Publish to Chrome Web Store

1. **Create developer account**: https://chrome.google.com/webstore/devconsole
2. **Prepare package**:
   ```bash
   cd packages/extension/dist
   zip -r ../chrome-web-store.zip *
   ```
3. **Upload** to Chrome Web Store
4. **Fill metadata**: Description, screenshots, privacy policy
5. **Submit for review**

### Deploy Server

#### Local Machine

```bash
# Run in production mode
cd packages/server
pnpm start

# Or with PM2 (keeps running)
npm install -g pm2
pm2 start dist/index.js --name claude-bridge-server
pm2 save
pm2 startup
```

#### Docker (Future)

```dockerfile
# Dockerfile (not yet implemented)
FROM node:18-alpine
WORKDIR /app
COPY packages/server .
RUN pnpm install --prod
CMD ["node", "dist/index.js"]
```

---

## Troubleshooting

### Server Won't Start

**Error**: `Port 9999 already in use`

```bash
# Find process using port 9999
lsof -i :9999

# Kill it
kill -9 <PID>

# Or use different port
WS_PORT=9998 pnpm dev:server
```

**Error**: `ANTHROPIC_AUTH_TOKEN not found`

```bash
# Verify .env exists
ls -la packages/server/.env

# Check contents
cat packages/server/.env

# Should contain:
# ANTHROPIC_AUTH_TOKEN=sk-ant-xxx
```

### Extension Won't Load

**Error**: "Manifest file is missing or unreadable"

```bash
# Verify manifest exists
ls packages/extension/dist/manifest.json

# If missing, rebuild
pnpm --filter @claude-bridge/extension build
```

**Error**: "Could not load background script"

```bash
# Check file exists
ls packages/extension/dist/background/service-worker.js

# If missing, rebuild
pnpm --filter @claude-bridge/extension build
```

### Extension Not Connecting

**Symptom**: Red connection indicator

1. **Check server is running**:
   ```bash
   pnpm dev:server
   ```

2. **Check port**:
   ```bash
   # Server should show:
   # 🌉 Claude Code Bridge running on ws://127.0.0.1:9999
   ```

3. **Check console**:
   - Open extension popup
   - Right-click → Inspect
   - Console should show WebSocket errors

4. **Manual test WebSocket**:
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://127.0.0.1:9999');
   ws.onopen = () => console.log('Connected!');
   ws.onerror = (e) => console.error('Error:', e);
   ```

### Build Errors

**Error**: `Cannot find module '@claude-bridge/shared'`

```bash
# Rebuild shared package
pnpm --filter @claude-bridge/shared build

# Reinstall dependencies
pnpm install
```

**Error**: `TypeScript errors`

```bash
# Check TypeScript version
pnpm list typescript

# Should be ^5.7.0

# Reinstall if needed
pnpm install -D typescript@^5.7.0
```

---

## Project Structure Reference

```
cloud-code-reviewer/
├── packages/
│   ├── extension/          # Chrome extension
│   │   ├── src/           # Source TypeScript
│   │   ├── popup/         # HTML/CSS
│   │   ├── assets/        # Icons
│   │   ├── dist/          # Built extension ← Load this
│   │   └── vite.config.ts
│   │
│   ├── server/            # WebSocket server
│   │   ├── src/          # Source TypeScript
│   │   ├── dist/         # Compiled JavaScript
│   │   └── .env          # API credentials
│   │
│   └── shared/           # Shared types
│       └── src/types.ts
│
├── docs/                  # Documentation
├── package.json          # Workspace root
└── pnpm-workspace.yaml
```

---

## Git Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature

# Create pull request on GitHub
```

### Commit Messages

Follow conventional commits:

```bash
git commit -m "feat: add dark mode toggle"
git commit -m "fix: resolve WebSocket reconnection issue"
git commit -m "docs: update API documentation"
git commit -m "chore: update dependencies"
```

---

## VS Code Setup

### Recommended Extensions

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript Vue Plugin** - TypeScript support
- **Chrome Debugger** - Debug extension

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev:server"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Performance Tips

### Fast Rebuild

```bash
# Use watch mode for development
pnpm dev:extension  # Auto-rebuilds on change
```

### Faster pnpm

```bash
# Use shamefully-hoist for faster installs
echo "shamefully-hoist=true" >> .npmrc
pnpm install
```

### Reduce Bundle Size

```bash
# Analyze extension bundle
cd packages/extension
pnpm add -D rollup-plugin-visualizer

# Update vite.config.ts
# import { visualizer } from 'rollup-plugin-visualizer';
# plugins: [visualizer()]

pnpm build
# Open stats.html
```

---

## Next Steps

- [Architecture Overview](./architecture.md)
- [Component Details](./components.md)
- [Data Flow Examples](./data-flow.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
