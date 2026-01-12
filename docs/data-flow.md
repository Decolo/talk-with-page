# Data Flow Documentation

This document illustrates how data flows through the Claude Code Bridge system with detailed examples.

## Message Flow Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────┐     ┌───────────┐
│   User      │────►│   Extension     │────►│  Server  │────►│  Claude   │
│ (Browser)   │     │  (Popup/Content)│     │  (WS)    │     │   AI      │
└─────────────┘     └─────────────────┘     └──────────┘     └───────────┘
      ▲                     │                      │                │
      │                     ▼                      ▼                ▼
      └──────────────── Streaming Response ◄──────────────────────┘
           (StreamMessage: status/text/tool/done)
```

## Flow Examples

### Example 1: Simple Command

**User Action**: Types "List files in current directory" in popup

#### Step-by-Step Flow

```
1. USER INPUT
   └─► User types in popup textarea
   └─► Clicks "Send" button

2. POPUP UI (popup.ts)
   └─► sendCommand() called
   └─► Creates ClientMessage:
       {
         type: 'command',
         id: 'popup-1736607123456',
         timestamp: 1736607123456,
         payload: {
           instruction: 'List files in current directory'
         }
       }
   └─► Adds user message to UI
   └─► chrome.runtime.sendMessage({ action: 'sendCommand', payload: message })

3. SERVICE WORKER (service-worker.ts)
   └─► Receives message from popup
   └─► sendToServer() called
   └─► ws.send(JSON.stringify(message))
   └─► WebSocket transmits to localhost:9999

4. SERVER (index.ts)
   └─► ws.on('message') receives data
   └─► Parses ClientMessage
   └─► buildPrompt() returns: 'List files in current directory'
   └─► Sends status message:
       {
         type: 'status',
         requestId: 'popup-1736607123456',
         content: 'Processing...',
         timestamp: 1736607123457
       }
   └─► Calls runAgent(prompt, messageId, ws)

5. CLAUDE AGENT (agent.ts)
   └─► Initializes Claude Agent SDK
   └─► Sends prompt to Anthropic API
   └─► Claude decides to use Bash tool
   └─► Streams response:
       - { type: 'tool', tool: 'Bash', requestId: ... }
       - { type: 'text', content: 'Here are the files:', requestId: ... }
       - { type: 'text', content: '- package.json', requestId: ... }
       - { type: 'text', content: '- src/', requestId: ... }
       - { type: 'done', requestId: ... }

6. SERVER → SERVICE WORKER
   └─► Each streamed message sent via ws.send()
   └─► Service worker receives via ws.onmessage
   └─► Stores in messageHistory
   └─► Broadcasts to popup via chrome.runtime.sendMessage

7. POPUP UI UPDATE
   └─► Receives streamMessage events
   └─► handleStreamMessage() called for each:
       - type='tool' → Shows "Using tool: Bash"
       - type='text' → Appends text to assistant message
       - type='done' → Marks complete
   └─► Auto-scrolls to latest message
```

#### Timeline Diagram

```
Time    Popup           Service Worker    Server          Claude API
────────────────────────────────────────────────────────────────────
t=0     User types
t=1     Send click
        │
t=2     Create msg ───►
        │               │
t=3     │               ws.send() ───────►
        │               │                 │
t=4     │               │                 Parse msg
t=5     │               │                 Build prompt
t=6     │               │                 runAgent() ────►
        │               │                 │               API call
t=7     │               ws.onmessage ◄──── Send status
        │               │
t=8     │               Broadcast ───►
        │               │
t=9     Show status ◄───┘
        │
t=10    │               ws.onmessage ◄──── Tool message
t=11    Show tool ◄───── Broadcast
        │
t=12    │               ws.onmessage ◄──── Text message
t=13    Append text ◄─── Broadcast
        │
t=14    │               ws.onmessage ◄──── Done message
t=15    Mark done ◄───── Broadcast
```

---

### Example 2: Element Picker Flow

**User Action**: Clicks "Pick Element" and selects a table on a webpage

#### Step-by-Step Flow

```
1. USER INTERACTION
   └─► User opens extension popup
   └─► Switches to "Page" tab
   └─► Clicks "Pick Element" button
   └─► Popup closes

2. POPUP UI (popup.ts)
   └─► activatePicker() called
   └─► Gets active tab: chrome.tabs.query({ active: true })
   └─► Sends message to content script:
       chrome.tabs.sendMessage(tabId, { action: 'activatePicker' })
   └─► window.close() - popup closes

3. CONTENT SCRIPT (content-script.ts)
   └─► Receives 'activatePicker' message
   └─► Calls activateElementPicker()
   └─► Imports and initializes ElementPicker class

4. ELEMENT PICKER (element-picker.ts)
   └─► activate() creates overlay:
       - Creates semi-transparent overlay div
       - Creates toolbar with instructions
       - Creates highlight box (border outline)
       - Attaches event listeners:
         - mousemove → update highlight position
         - click → select element
         - keydown → cancel (Escape)
   └─► Appends to document.body
   └─► Sets z-index: 999999

5. USER HOVERS OVER TABLE
   └─► mousemove event fires
   └─► handleMouseMove(e) called
   └─► Gets element under cursor
   └─► Positions highlight box around element
   └─► Updates tooltip with selector

6. USER CLICKS TABLE
   └─► click event fires
   └─► handleClick(e) called
   └─► e.preventDefault() + e.stopPropagation()
   └─► Gets target element: <table id="data-table">
   └─► Calls extractContent(tableElement)

7. CONTENT PARSING
   └─► extractContent() checks tagName
   └─► tagName === 'table' → parseTable() called
   └─► parseTable() logic:
       for (let i = 0; i < table.rows.length; i++) {
         for (let j = 0; j < table.rows[i].cells.length; j++) {
           rows[i][j] = cell.innerText.trim();
         }
       }
   └─► Returns structured data:
       {
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

8. SEND TO BACKGROUND
   └─► sendToBackground(content) called
   └─► Creates ClientMessage:
       {
         type: 'element_content',
         id: 'elem-1736607123456',
         timestamp: 1736607123456,
         payload: {
           selector: '#data-table',
           tagName: 'table',
           elementType: 'table',
           structured: {
             rows: [['Name', 'Age', 'City'], ...]
           }
         }
       }
   └─► chrome.runtime.sendMessage({ action: 'sendCommand', payload: message })
   └─► deactivate() - removes overlay

9. SERVICE WORKER → SERVER
   └─► Receives message from content script
   └─► ws.send(JSON.stringify(message))
   └─► Sent to server

10. SERVER PROCESSING
    └─► Receives element_content message
    └─► buildPrompt() creates:
        "Analyze this table element:
         Selector: #data-table
         Tag: table
         Data:
         [Table rows displayed as formatted text]"
    └─► Calls runAgent()

11. CLAUDE RESPONSE
    └─► Claude analyzes table structure
    └─► Streams response:
        "I can see a table with 3 columns (Name, Age, City)
         and 2 data rows. The table contains information about
         people including Alice (30, NYC) and Bob (25, SF)."
    └─► Done

12. POPUP DISPLAYS RESULT
    └─► User reopens extension popup
    └─► Sees conversation history with:
        - User: "Picked element: table#data-table"
        - Assistant: [Claude's analysis]
```

#### Visual Sequence

```
┌──────────────┐
│ Popup Open   │
│ [Pick Elem]  │ ← User clicks
└──────┬───────┘
       │ chrome.tabs.sendMessage
       ▼
┌──────────────────────────────┐
│     Web Page                 │
│  ┌────────────────────────┐  │
│  │  Overlay Appears       │  │ ← Picker activates
│  │  [Esc to cancel]       │  │
│  └────────────────────────┘  │
│                              │
│  ╔═══════════════════╗       │
│  ║  Highlighted!     ║       │ ← User hovers table
│  ║  #data-table      ║       │
│  ╚═══════════════════╝       │
│                              │
└──────────┬───────────────────┘
           │ User clicks
           ▼
┌──────────────────────────────┐
│  Parse Table:                │
│  rows = [                    │
│    ['Name', 'Age', 'City'],  │
│    ['Alice', '30', 'NYC'],   │
│    ['Bob', '25', 'SF']       │
│  ]                           │
└──────────┬───────────────────┘
           │ chrome.runtime.sendMessage
           ▼
┌──────────────────────────────┐
│  Service Worker              │
│  ws.send(ClientMessage)      │
└──────────┬───────────────────┘
           │ WebSocket
           ▼
┌──────────────────────────────┐
│  Server → Claude API         │
│  Stream response back        │
└──────────────────────────────┘
```

---

### Example 3: Page Analysis

**User Action**: Clicks "Analyze Current Page"

#### Flow

```
1. USER CLICK
   └─► Clicks "Analyze Current Page" in Page tab

2. POPUP UI
   └─► analyzeCurrentPage() called
   └─► Gets active tab: chrome.tabs.query({ active: true })
   └─► Sends message to content script:
       chrome.tabs.sendMessage(tabId, { action: 'getPageContent' })

3. CONTENT SCRIPT
   └─► Receives 'getPageContent' message
   └─► Extracts page data:
       {
         url: window.location.href,
         title: document.title,
         content: document.body.innerText,
         selectedText: window.getSelection()?.toString() || ''
       }
   └─► Returns via sendResponse()

4. POPUP RECEIVES DATA
   └─► Creates ClientMessage:
       {
         type: 'page_content',
         id: 'page-1736607123456',
         timestamp: 1736607123456,
         payload: {
           url: 'https://example.com/article',
           title: 'Example Article',
           content: 'Full page text content...',
           selectedText: ''
         }
       }
   └─► Sends to service worker

5. SERVER PROCESSING
   └─► buildPrompt() creates:
       "Analyze this web page content:

        URL: https://example.com/article
        Title: Example Article

        Content:
        [First 10,000 characters of page text]

        Please provide a concise analysis."
   └─► Calls runAgent()

6. CLAUDE ANALYSIS
   └─► Streams back page summary
   └─► May use tools if needed (e.g., Write to save notes)
```

---

## Connection State Flow

### Initial Connection

```
Extension Loads
    ├─► Service Worker starts
    ├─► connect() called
    ├─► connectionState = 'connecting'
    ├─► Broadcast status to popup (yellow indicator)
    │
    └─► WebSocket.onopen
        ├─► connectionState = 'connected'
        ├─► reconnectAttempts = 0
        ├─► Broadcast status (green indicator)
        └─► Server sends welcome message
```

### Reconnection Flow

```
Connection Lost
    ├─► WebSocket.onclose
    ├─► connectionState = 'disconnected'
    ├─► ws = null
    ├─► Broadcast status (red indicator)
    │
    └─► scheduleReconnect()
        ├─► Calculate delay: min(1000 * 2^attempts, 30000)
        │   - Attempt 0: 1 second
        │   - Attempt 1: 2 seconds
        │   - Attempt 2: 4 seconds
        │   - Attempt 3: 8 seconds
        │   - Attempt 4: 16 seconds
        │   - Attempt 5+: 30 seconds (max)
        │
        └─► setTimeout(() => connect(), delay)
            └─► Retry connection
```

### State Diagram

```
┌──────────────┐
│ Disconnected │
└──────┬───────┘
       │ connect()
       ▼
┌──────────────┐         WebSocket.onerror
│ Connecting   │◄────────────┐
└──────┬───────┘             │
       │ WebSocket.onopen    │
       ▼                     │
┌──────────────┐             │
│  Connected   │─────────────┘
└──────┬───────┘  WebSocket.onclose
       │               │
       └───────────────┘
       Reconnect with backoff
```

---

## Message History Flow

### Storage

```
Service Worker receives StreamMessage
    ├─► messageHistory.push(message)
    ├─► Check length: if (messageHistory.length > 100)
    │   └─► messageHistory.shift()  // Remove oldest
    │
    └─► Stored in memory (not persistent)
```

### Retrieval

```
Popup opens
    ├─► chrome.runtime.sendMessage({ action: 'getHistory' })
    │
    └─► Service Worker responds
        └─► sendResponse({ history: messageHistory })
            │
            └─► Popup renders all messages
                ├─► Group by requestId
                ├─► Show user/assistant/tool messages
                └─► Auto-scroll to bottom
```

### Clear History

```
User clicks "Clear History"
    ├─► chrome.runtime.sendMessage({ action: 'clearHistory' })
    │
    └─► Service Worker
        ├─► messageHistory = []
        └─► sendResponse({ success: true })
            │
            └─► Popup clears UI
```

---

## Error Handling Flow

### WebSocket Error

```
Network Issue
    ├─► WebSocket.onerror
    ├─► WebSocket.onclose (automatically called)
    │
    └─► Service Worker
        ├─► connectionState = 'disconnected'
        ├─► Broadcast error status
        └─► scheduleReconnect()
```

### Server Error

```
Server encounters error
    ├─► Sends StreamMessage:
    │   {
    │     type: 'error',
    │     requestId: 'cmd-123',
    │     content: 'File not found: config.json',
    │     timestamp: 1736607123456
    │   }
    │
    └─► Service Worker receives
        ├─► Stores in history
        └─► Broadcasts to popup
            │
            └─► Popup displays error message (red background)
```

### Invalid Message

```
Malformed JSON
    ├─► Server: JSON.parse() throws
    │
    └─► Catch block
        └─► ws.send({
              type: 'error',
              requestId: 'unknown',
              content: 'Invalid message format',
              timestamp: ...
            })
```

---

## Performance Optimization

### Streaming vs Batching

**Current (Streaming)**:
```
Claude generates text token-by-token
    └─► Each token → StreamMessage
        └─► ws.send() immediately
            └─► User sees text appear in real-time
```

**Alternative (Batching)** - Not used:
```
Claude generates all text
    └─► Wait until complete
        └─► Send one large message
            └─► User waits, then sees full response
                (Worse UX)
```

### Message Deduplication

Service worker maintains `messageHistory` to avoid re-processing:

```typescript
// When popup reopens
const { history } = await chrome.runtime.sendMessage({ action: 'getHistory' });

// Render existing history without re-requesting from server
this.renderHistory(history);
```

### Connection Pooling

Only one WebSocket connection shared across:
- Popup (may close/reopen)
- Multiple content scripts (different tabs)
- Background operations

```
Service Worker (persistent)
    └─► Single WebSocket connection
        ├─► Routes to Popup (if open)
        ├─► Routes to Content Script (tab 1)
        ├─► Routes to Content Script (tab 2)
        └─► Routes to Content Script (tab N)
```
