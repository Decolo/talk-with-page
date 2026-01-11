import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

let ws: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
let messageHistory: StreamMessage[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const SERVER_URL = 'ws://127.0.0.1:9999';

// Initialize connection on startup
connect();

function connect(): void {
  if (connectionState === 'connecting' || connectionState === 'connected') return;

  connectionState = 'connecting';
  broadcastConnectionStatus();

  try {
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
      console.log('[Service Worker] Connected to server');
      connectionState = 'connected';
      reconnectAttempts = 0;
      broadcastConnectionStatus();
    };

    ws.onmessage = (event) => {
      const message: StreamMessage = JSON.parse(event.data);
      console.log('[Service Worker] Received:', message.type);

      // Store in history
      messageHistory.push(message);
      if (messageHistory.length > 100) {
        messageHistory.shift(); // Keep last 100 messages
      }

      // Broadcast to popup
      broadcastStreamMessage(message);
    };

    ws.onclose = () => {
      console.log('[Service Worker] Disconnected from server');
      connectionState = 'disconnected';
      ws = null;
      broadcastConnectionStatus();
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[Service Worker] WebSocket error:', error);
    };

  } catch (error) {
    console.error('[Service Worker] Connection failed:', error);
    connectionState = 'disconnected';
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[Service Worker] Reconnecting in ${delay}ms...`);
  setTimeout(connect, delay);
}

function sendToServer(message: ClientMessage): void {
  if (connectionState !== 'connected' || !ws) {
    console.error('[Service Worker] Not connected to server');
    broadcastStreamMessage({
      type: 'error',
      requestId: message.id,
      content: 'Not connected to server. Please check if the server is running.',
      timestamp: Date.now()
    });
    return;
  }

  console.log('[Service Worker] Sending:', message.type);
  ws.send(JSON.stringify(message));
}

function broadcastStreamMessage(message: StreamMessage): void {
  chrome.runtime.sendMessage({
    action: 'streamUpdate',
    data: message
  }).catch(() => {
    // Popup might be closed, ignore
  });
}

function broadcastConnectionStatus(): void {
  chrome.runtime.sendMessage({
    action: 'connectionStatusChanged',
    status: connectionState
  }).catch(() => {
    // Popup might be closed, ignore
  });
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'sendCommand':
      sendToServer(request.payload as ClientMessage);
      sendResponse({ success: true });
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
      if (connectionState === 'disconnected') {
        connect();
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep channel open for async response
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('[Service Worker] Extension started');
  connect();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Service Worker] Extension installed');
  connect();
});
