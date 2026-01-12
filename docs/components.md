# Component Documentation

This document provides detailed technical specifications for each component in the Claude Code Bridge system.

## Table of Contents

- [Shared Types](#shared-types)
- [WebSocket Server](#websocket-server)
- [Chrome Extension](#chrome-extension)
  - [Service Worker](#service-worker)
  - [Content Script](#content-script)
  - [Element Picker](#element-picker)
  - [Popup UI](#popup-ui)

---

## Shared Types

**Location**: `packages/shared/src/types.ts`
**Package**: `@claude-bridge/shared`
**Purpose**: Type definitions shared between server and extension

### Message Protocol

#### ClientMessage (Extension → Server)

```typescript
export interface ClientMessage {
  type: 'command' | 'page_content' | 'element_content';
  id: string;                    // Unique message ID
  timestamp: number;              // Unix timestamp
  payload: {
    // For 'command' type
    instruction?: string;         // User command
    context?: string;            // Additional context

    // For 'page_content' type
    url?: string;                // Page URL
    title?: string;              // Page title
    content?: string;            // Page text content
    selectedText?: string;       // Selected text

    // For 'element_content' type
    selector?: string;           // CSS selector
    tagName?: string;            // HTML tag name
    elementType?: 'text' | 'table' | 'list' | 'code';
    structured?: Record<string, unknown>;  // Parsed data
  };
}
```

**Message Types**:

1. **`command`**: Direct user instruction
   ```typescript
   {
     type: 'command',
     id: 'cmd-1234567890',
     timestamp: 1736607123456,
     payload: {
       instruction: 'List files in current directory',
       context: 'User is in /home/project'
     }
   }
   ```

2. **`page_content`**: Webpage analysis request
   ```typescript
   {
     type: 'page_content',
     id: 'page-1234567890',
     timestamp: 1736607123456,
     payload: {
       url: 'https://example.com',
       title: 'Example Page',
       content: 'Full page text...',
       selectedText: 'Highlighted portion...'
     }
   }
   ```

3. **`element_content`**: Specific element analysis
   ```typescript
   {
     type: 'element_content',
     id: 'elem-1234567890',
     timestamp: 1736607123456,
     payload: {
       selector: '#data-table',
       tagName: 'table',
       elementType: 'table',
       structured: {
         rows: [
           ['Name', 'Age', 'City'],
           ['Alice', '30', 'NYC'],
           ['Bob', '25', 'SF']
         ]
       }
     }
   }
   ```

#### StreamMessage (Server → Extension)

```typescript
export interface StreamMessage {
  type: 'status' | 'text' | 'tool' | 'error' | 'done';
  requestId: string;             // Original ClientMessage.id
  content?: string;              // Message content
  tool?: string;                 // Tool name (for type='tool')
  timestamp: number;             // Unix timestamp
}
```

**Message Types**:

1. **`status`**: Processing update
   ```typescript
   { type: 'status', requestId: 'cmd-123', content: 'Processing...', timestamp: 123 }
   ```

2. **`text`**: Claude's response text (streamed)
   ```typescript
   { type: 'text', requestId: 'cmd-123', content: 'Here are the files:', timestamp: 123 }
   ```

3. **`tool`**: Tool execution notification
   ```typescript
   { type: 'tool', requestId: 'cmd-123', tool: 'Bash', timestamp: 123 }
   ```

4. **`error`**: Error message
   ```typescript
   { type: 'error', requestId: 'cmd-123', content: 'Connection failed', timestamp: 123 }
   ```

5. **`done`**: Request completed
   ```typescript
   { type: 'done', requestId: 'cmd-123', timestamp: 123 }
   ```

---

## WebSocket Server

**Location**: `packages/server/`
**Package**: `@claude-bridge/server`
**Runtime**: Node.js (ESM)

### Dependencies

```json
{
  "ws": "^8.18.0",                                // WebSocket server
  "@anthropic-ai/claude-agent-sdk": "latest",     // Claude integration
  "dotenv": "^16.4.0"                             // Environment config
}
```

### File Structure

```
packages/server/
├── src/
│   ├── index.ts      # WebSocket server & message router
│   ├── agent.ts      # Claude Agent SDK wrapper
│   └── types.ts      # Re-exports from shared
├── .env              # Environment variables (gitignored)
├── package.json
└── tsconfig.json
```

### index.ts - WebSocket Server

**Location**: `packages/server/src/index.ts`

**Responsibilities**:
- Create WebSocket server on `ws://127.0.0.1:9999`
- Listen for incoming connections
- Parse `ClientMessage` from extension
- Build appropriate prompts
- Call Claude Agent SDK
- Stream responses back to extension

**Key Functions**:

```typescript
// Server initialization
const wss = new WebSocketServer({ port: 9999, host: '127.0.0.1' });

// Connection handler
wss.on('connection', (ws) => {
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'status',
    requestId: 'system',
    content: 'Connected to Claude Code Bridge',
    timestamp: Date.now()
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    const message: ClientMessage = JSON.parse(data.toString());
    const prompt = buildPrompt(message);
    await runAgent(prompt, message.id, ws);
  });
});
```

**buildPrompt()**:
```typescript
function buildPrompt(message: ClientMessage): string {
  if (message.type === 'command') {
    return message.payload.context
      ? `Context: ${context}\n\nUser request: ${instruction}`
      : instruction || '';
  }

  if (message.type === 'page_content') {
    return `
      Analyze this web page content:

      URL: ${url}
      Title: ${title}

      ${selectedText ? `Selected Text:\n${selectedText}\n` : ''}

      Content:
      ${content.substring(0, 10000)}

      Please provide a concise analysis.
    `;
  }

  return '';
}
```

### agent.ts - Claude Agent SDK

**Location**: `packages/server/src/agent.ts`

**Responsibilities**:
- Initialize Claude Agent SDK with tools
- Stream responses via WebSocket
- Handle tool execution
- Send StreamMessage updates

**Configuration**:

```typescript
const agent = new ClaudeAgent({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  tools: ['Bash', 'Read', 'Write', 'Glob', 'Edit']
});
```

**Streaming Flow**:

```typescript
async function runAgent(prompt: string, requestId: string, ws: WebSocket) {
  const stream = agent.run(prompt);

  for await (const message of stream) {
    if (message.type === 'text') {
      ws.send(JSON.stringify({
        type: 'text',
        requestId,
        content: message.content,
        timestamp: Date.now()
      }));
    }

    if (message.type === 'tool_use') {
      ws.send(JSON.stringify({
        type: 'tool',
        requestId,
        tool: message.tool,
        timestamp: Date.now()
      }));
    }
  }

  ws.send(JSON.stringify({
    type: 'done',
    requestId,
    timestamp: Date.now()
  }));
}
```

### Environment Variables

**File**: `packages/server/.env` (gitignored)

```env
# Required
ANTHROPIC_AUTH_TOKEN=sk-ant-xxx   # Claude API key
ANTHROPIC_BASE_URL=https://code.aipor.cc/api  # API endpoint

# Optional
WS_PORT=9999                       # WebSocket port
API_TIMEOUT_MS=3000000             # 50 minutes
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

---

## Chrome Extension

**Location**: `packages/extension/`
**Package**: `@claude-bridge/extension`
**Manifest**: V3

### Dependencies

```json
{
  "@claude-bridge/shared": "workspace:*",  // Type definitions
  "@types/chrome": "^0.0.270",            // Chrome API types
  "typescript": "^5.7.0",
  "vite": "^5.4.0"                        // Bundler
}
```

### manifest.json

**Location**: `packages/extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Claude Code Bridge",
  "version": "1.0.0",
  "description": "Connect to local Claude Agent SDK server",

  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content-script.js"],
    "run_at": "document_idle"
  }]
}
```

---

## Service Worker

**Location**: `packages/extension/src/background/service-worker.ts`
**Compiled**: `dist/background/service-worker.js`

### Responsibilities

- Maintain WebSocket connection to server
- Route messages between popup, content scripts, and server
- Store message history (last 100 messages)
- Handle auto-reconnection with exponential backoff
- Broadcast connection status changes

### State Management

```typescript
let ws: WebSocket | null = null;
let connectionState: 'disconnected' | 'connecting' | 'connected';
let messageHistory: StreamMessage[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const SERVER_URL = 'ws://127.0.0.1:9999';
```

### Connection Management

```typescript
function connect(): void {
  if (connectionState === 'connecting' || connectionState === 'connected') return;

  connectionState = 'connecting';
  broadcastConnectionStatus();

  ws = new WebSocket(SERVER_URL);

  ws.onopen = () => {
    connectionState = 'connected';
    reconnectAttempts = 0;
    broadcastConnectionStatus();
  };

  ws.onmessage = (event) => {
    const message: StreamMessage = JSON.parse(event.data);
    messageHistory.push(message);
    if (messageHistory.length > 100) messageHistory.shift();
    broadcastStreamMessage(message);
  };

  ws.onclose = () => {
    connectionState = 'disconnected';
    ws = null;
    broadcastConnectionStatus();
    scheduleReconnect();
  };
}

function scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  setTimeout(connect, delay);
}
```

### Message Routing

```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'sendCommand':
      sendToServer(request.payload as ClientMessage);
      break;

    case 'getHistory':
      sendResponse({ history: messageHistory });
      break;

    case 'getConnectionStatus':
      sendResponse({ status: connectionState });
      break;

    case 'clearHistory':
      messageHistory = [];
      sendResponse({ success: true });
      break;

    case 'reconnect':
      if (connectionState === 'disconnected') connect();
      sendResponse({ success: true });
      break;
  }
  return true;
});
```

---

## Content Script

**Location**: `packages/extension/src/content/content-script.ts`
**Compiled**: `dist/content/content-script.js`
**Injected**: All pages (`<all_urls>`)

### Responsibilities

- Extract page content (text, title, URL)
- Get selected text
- Activate element picker
- Send page/element data to service worker

### Message Handlers

```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageContent':
      sendResponse({
        url: window.location.href,
        title: document.title,
        content: document.body.innerText,
        selectedText: window.getSelection()?.toString() || ''
      });
      break;

    case 'activatePicker':
      activateElementPicker();
      sendResponse({ success: true });
      break;
  }
  return true;
});
```

---

## Element Picker

**Location**: `packages/extension/src/content/element-picker.ts`
**Styles**: `packages/extension/src/content/element-picker.css`

### Responsibilities

- Create interactive overlay
- Highlight hovered elements
- Parse selected element by type
- Send structured data to background

### ElementPicker Class

```typescript
class ElementPicker {
  private overlay: HTMLDivElement | null = null;
  private highlightBox: HTMLDivElement | null = null;
  private isActive = false;

  activate(): void {
    // Create overlay with toolbar
    this.overlay = document.createElement('div');
    this.overlay.className = 'claude-picker-overlay';

    // Create highlight box
    this.highlightBox = document.createElement('div');
    this.highlightBox.className = 'claude-picker-highlight';

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick);
    document.addEventListener('keydown', this.handleKeyDown);

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.highlightBox);
    this.isActive = true;
  }

  private handleClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const content = this.extractContent(target);
    this.sendToBackground(content);
    this.deactivate();
  };

  private extractContent(element: HTMLElement): any {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'table') return this.parseTable(element as HTMLTableElement);
    if (tagName === 'ul' || tagName === 'ol') return this.parseList(element);
    if (tagName === 'pre' || tagName === 'code') return this.parseCodeBlock(element);

    return {
      selector: this.generateSelector(element),
      tagName,
      elementType: 'text',
      content: element.innerText
    };
  }
}
```

### Smart Parsing

#### Table Parsing

```typescript
private parseTable(table: HTMLTableElement): any {
  const rows: string[][] = [];

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const cells = Array.from(row.cells).map(cell => cell.innerText.trim());
    rows.push(cells);
  }

  return {
    selector: this.generateSelector(table),
    tagName: 'table',
    elementType: 'table',
    structured: { rows }
  };
}
```

#### List Parsing

```typescript
private parseList(list: HTMLElement): any {
  const items = Array.from(list.querySelectorAll('li'))
    .map(li => li.innerText.trim());

  return {
    selector: this.generateSelector(list),
    tagName: list.tagName.toLowerCase(),
    elementType: 'list',
    structured: { items }
  };
}
```

#### Code Block Parsing

```typescript
private parseCodeBlock(element: HTMLElement): any {
  return {
    selector: this.generateSelector(element),
    tagName: element.tagName.toLowerCase(),
    elementType: 'code',
    content: element.textContent || '',
    language: element.className.match(/language-(\w+)/)?.[1]
  };
}
```

---

## Popup UI

**Location**: `packages/extension/popup/` and `packages/extension/src/popup/`
**Files**: `popup.html`, `popup.css`, `popup.ts`

### Structure (popup.html)

```html
<div class="container">
  <header class="header">
    <h1>Claude Bridge</h1>
    <div id="connection-status" class="status-indicator"></div>
  </header>

  <nav class="tabs">
    <button class="tab active" data-tab="chat">Chat</button>
    <button class="tab" data-tab="page">Page</button>
    <button class="tab" data-tab="settings">Settings</button>
  </nav>

  <!-- Chat Tab -->
  <div id="chat-panel" class="panel active">
    <div id="message-list" class="message-list"></div>
    <div class="input-area">
      <textarea id="command-input" placeholder="Ask Claude..."></textarea>
      <button id="send-btn">Send</button>
      <button id="pick-element-btn">Pick</button>
    </div>
  </div>

  <!-- Page Tab -->
  <div id="page-panel" class="panel">
    <button id="analyze-page-btn">Analyze Current Page</button>
    <button id="analyze-selection-btn">Analyze Selection</button>
    <button id="pick-element-btn-2">Pick Element</button>
  </div>

  <!-- Settings Tab -->
  <div id="settings-panel" class="panel">
    <input type="text" id="server-url" value="ws://127.0.0.1:9999" readonly>
    <button id="clear-history-btn">Clear History</button>
    <button id="reconnect-btn">Reconnect</button>
  </div>
</div>
```

### PopupController Class (popup.ts)

```typescript
class PopupController {
  async init(): Promise<void> {
    // Get initial state
    const { history } = await chrome.runtime.sendMessage({ action: 'getHistory' });
    const { status } = await chrome.runtime.sendMessage({ action: 'getConnectionStatus' });

    // Render history
    this.renderHistory(history);
    this.updateConnectionStatus(status);

    // Listen for updates
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'streamMessage') this.handleStreamMessage(msg.data);
      if (msg.type === 'connectionStatus') this.updateConnectionStatus(msg.status);
    });

    // Bind events
    this.bindEvents();
  }

  private async sendCommand(): Promise<void> {
    const instruction = this.commandInput.value.trim();

    const message: ClientMessage = {
      type: 'command',
      id: `popup-${Date.now()}`,
      timestamp: Date.now(),
      payload: { instruction }
    };

    this.addMessage('user', instruction);
    chrome.runtime.sendMessage({ action: 'sendCommand', payload: message });
  }

  private handleStreamMessage(msg: StreamMessage): void {
    switch (msg.type) {
      case 'text':
        this.addMessage('assistant', msg.content);
        break;
      case 'tool':
        this.addMessage('tool', `Using tool: ${msg.tool}`);
        break;
      case 'error':
        this.addMessage('error', msg.content);
        break;
    }
  }
}
```

### Styling (popup.css)

**Theme**: Dark mode with VS Code colors

```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --accent: #4ec9b0;
  --text-primary: #d4d4d4;
}

.message.user {
  background: var(--accent);
  color: var(--bg-primary);
  align-self: flex-end;
}

.message.assistant {
  background: var(--bg-secondary);
  align-self: flex-start;
}
```
