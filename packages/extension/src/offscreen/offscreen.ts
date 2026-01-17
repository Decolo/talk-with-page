import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

let ws: WebSocket | null = null;
let connectionState: ConnectionState = 'disconnected';
const SERVER_URL = 'ws://127.0.0.1:9999';

// Connect on load
connect();

function connect(): void {
  if (connectionState === 'connecting' || connectionState === 'connected') return;

  connectionState = 'connecting';
  notifyConnectionStatus();

  try {
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
      console.log('[Offscreen] Connected to server');
      connectionState = 'connected';
      notifyConnectionStatus();
    };

    ws.onmessage = (event) => {
      const message: StreamMessage = JSON.parse(event.data);
      console.log('[Offscreen] Received:', message.type);

      // Forward to service worker
      chrome.runtime.sendMessage({
        target: 'service-worker',
        action: 'wsMessage',
        data: message
      });
    };

    ws.onclose = () => {
      console.log('[Offscreen] Disconnected from server');
      connectionState = 'disconnected';
      ws = null;
      notifyConnectionStatus();

      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('[Offscreen] WebSocket error:', error);
    };

  } catch (error) {
    console.error('[Offscreen] Connection failed:', error);
    connectionState = 'disconnected';
    setTimeout(connect, 3000);
  }
}

function notifyConnectionStatus(): void {
  chrome.runtime.sendMessage({
    target: 'service-worker',
    action: 'connectionStatusChanged',
    status: connectionState
  });
}

function sendToServer(message: ClientMessage): void {
  if (connectionState !== 'connected' || !ws) {
    console.error('[Offscreen] Not connected to server');
    chrome.runtime.sendMessage({
      target: 'service-worker',
      action: 'wsMessage',
      data: {
        type: 'error',
        requestId: message.id,
        content: 'Not connected to server. Please check if the server is running.',
        timestamp: Date.now()
      } as StreamMessage
    });
    return;
  }

  console.log('[Offscreen] Sending:', message.type);
  ws.send(JSON.stringify(message));
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.target !== 'offscreen') return;

  switch (request.action) {
    case 'sendCommand':
      sendToServer(request.payload as ClientMessage);
      sendResponse({ success: true });
      break;

    case 'getConnectionStatus':
      sendResponse({ status: connectionState });
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

  return true;
});

console.log('[Offscreen] Document loaded');
