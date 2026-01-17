import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

let connectionState: ConnectionState = 'disconnected';
let messageHistory: StreamMessage[] = [];

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

// Ensure offscreen document exists on startup
ensureOffscreenDocument();

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[Service Worker] Offscreen document already exists');
    return;
  }

  console.log('[Service Worker] Creating offscreen document');
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Maintain persistent WebSocket connection to local server'
    });
    console.log('[Service Worker] Offscreen document created');
  } catch (error) {
    console.error('[Service Worker] Failed to create offscreen document:', error);
  }
}

// Forward command to offscreen document
async function sendToOffscreen(message: ClientMessage): Promise<void> {
  await ensureOffscreenDocument();

  chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'sendCommand',
    payload: message
  });
}

function broadcastToPopup(action: string, data: unknown): void {
  chrome.runtime.sendMessage({
    action,
    data
  }).catch(() => {
    // Popup might be closed, ignore
  });
}

// Listen for messages from popup, content scripts, and offscreen document
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Messages from offscreen document
  if (request.target === 'service-worker') {
    switch (request.action) {
      case 'wsMessage':
        const message = request.data as StreamMessage;
        console.log('[Service Worker] WS message:', message.type);

        // Store in history
        messageHistory.push(message);
        if (messageHistory.length > 100) {
          messageHistory.shift();
        }

        // Broadcast to popup
        broadcastToPopup('streamUpdate', message);
        break;

      case 'connectionStatusChanged':
        connectionState = request.status;
        console.log('[Service Worker] Connection status:', connectionState);
        broadcastToPopup('connectionStatusChanged', { status: connectionState });
        break;
    }
    return;
  }

  // Messages from popup/content scripts
  switch (request.action) {
    case 'sendCommand':
      sendToOffscreen(request.payload as ClientMessage);
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
      ensureOffscreenDocument().then(() => {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'reconnect'
        });
      });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});

// Keep offscreen document alive on extension events
chrome.runtime.onStartup.addListener(() => {
  console.log('[Service Worker] Extension started');
  ensureOffscreenDocument();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Service Worker] Extension installed');
  ensureOffscreenDocument();
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
