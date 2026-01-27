import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';

class PopupController {
  private messageList: HTMLElement;
  private commandInput: HTMLTextAreaElement;
  private connectionStatus: HTMLElement;
  private pageInfo: HTMLElement;
  private lastSentPageUrl: string | null = null;

  constructor() {
    this.messageList = document.getElementById('message-list')!;
    this.commandInput = document.getElementById('command-input') as HTMLTextAreaElement;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.pageInfo = document.getElementById('page-info')!;
  }

  async init(): Promise<void> {
    // Load history
    const { history } = await chrome.runtime.sendMessage({ action: 'getHistory' });
    if (history && history.length > 0) {
      this.renderHistory(history);
    }

    // Check connection status
    const { status } = await chrome.runtime.sendMessage({ action: 'getConnectionStatus' });
    this.updateConnectionStatus(status);

    // Listen for updates from background
    chrome.runtime.onMessage.addListener((message) => {
      this.handleBackgroundMessage(message);
    });

    // Bind events
    this.bindEvents();

    // Focus input
    this.commandInput.focus();

    // Display version info
    this.displayVersionInfo();
  }

  private bindEvents(): void {
    // Send button
    document.getElementById('send-btn')!.addEventListener('click', () => this.sendCommand());

    // Pick element button
    document.getElementById('pick-element-btn')!.addEventListener('click', () => this.activatePicker());

    // Page preview buttons
    document.getElementById('preview-page-btn')!.addEventListener('click', () => this.previewPage());
    document.getElementById('preview-raw-btn')!.addEventListener('click', () => this.previewRawHTML());

    // Settings buttons
    document.getElementById('clear-history-btn')!.addEventListener('click', () => this.clearHistory());
    document.getElementById('reconnect-btn')!.addEventListener('click', () => this.reconnect());

    // Textarea enter to send
    this.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendCommand();
      }
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab!;
        this.switchTab(tabName);
      });
    });
  }

  private switchTab(tabName: string): void {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabName);
    });

    // Update panels
    document.querySelectorAll('.panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
  }

  private async sendCommand(): Promise<void> {
    const instruction = this.commandInput.value.trim();
    if (!instruction) return;

    // Get current tab info for context
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab?.url || '';

    // Determine if we need full page data
    const needsFullPageData = !this.lastSentPageUrl || this.lastSentPageUrl !== currentUrl;

    let payload: any = {
      instruction,
      url: currentUrl,
      title: tab?.title || 'Untitled'
    };

    // If first command or page changed, include full page data
    if (needsFullPageData && tab?.id) {
      try {
        const pageData = await this.getFullPageData(tab.id);
        if (pageData && pageData.content) {
          payload = { ...payload, ...pageData };  // Add content, images, videos
          this.lastSentPageUrl = currentUrl;
          console.log('[Popup] Sending full page context:', {
            url: currentUrl,
            contentLength: pageData.content?.length || 0,
            imagesCount: pageData.images?.length || 0,
            videosCount: pageData.videos?.length || 0
          });
        } else {
          console.warn('[Popup] Page data is empty, sending minimal context');
        }
      } catch (error) {
        console.error('[Popup] Failed to get page data:', error);
        this.addMessage('status', 'Note: Could not load page content. The page may not allow content scripts.');
        // Continue with minimal context
      }
    } else {
      console.log('[Popup] Sending minimal context (reusing stored context)');
    }

    const message: ClientMessage = {
      type: 'command',
      id: `popup-${Date.now()}`,
      timestamp: Date.now(),
      payload
    };

    // Add user message to UI immediately
    this.addMessage('user', instruction);
    this.commandInput.value = '';

    // Send to background
    chrome.runtime.sendMessage({ action: 'sendCommand', payload: message });
  }

  private async getFullPageData(tabId: number): Promise<{
    content: string;
    images: string[];
    videos: string[];
  }> {
    // First, try to communicate with existing content script
    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'getFullPageData' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else if (!response) {
            reject(new Error('No response from content script'));
          } else {
            resolve(response);
          }
        });
      });
      return response;
    } catch (error) {
      // Content script not responding, inject it programmatically
      console.log('[Popup] Content script not responding, injecting programmatically...');

      try {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/content-script.js']
        });

        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try again
        const response = await new Promise<any>((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { action: 'getFullPageData' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.error) {
              reject(new Error(response.error));
            } else if (!response) {
              reject(new Error('No response after injection'));
            } else {
              resolve(response);
            }
          });
        });
        return response;
      } catch (injectionError) {
        console.error('[Popup] Failed to inject content script:', injectionError);
        throw new Error('Could not access page content');
      }
    }
  }

  private async previewPage(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      this.pageInfo.innerHTML = '<p style="color: red;">No active tab found.</p>';
      return;
    }

    try {
      const content = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });

      if (content.error) {
        this.pageInfo.innerHTML = `<p style="color: red;">Error: ${content.error}</p>`;
        return;
      }

      // Display parsed content in page-info div
      const preview = `
<strong>URL:</strong> ${content.url}
<strong>Title:</strong> ${content.title}
<strong>Site:</strong> ${content.siteName || 'N/A'}
<strong>Author:</strong> ${content.byline || 'N/A'}
<strong>Length:</strong> ${content.length} chars
<strong>Excerpt:</strong> ${content.excerpt || 'N/A'}

<strong>Content Preview (first 2000 chars):</strong>
${content.content?.substring(0, 2000) || 'No content extracted'}${content.content?.length > 2000 ? '...' : ''}
      `.trim();

      this.pageInfo.innerHTML = `<pre style="white-space: pre-wrap; font-size: 11px; max-height: 300px; overflow-y: auto;">${preview}</pre>`;

      // Also log to console for easier inspection
      console.log('[Preview] Parsed page content:', content);
    } catch (error) {
      console.error('[Preview] Error:', error);
      this.pageInfo.innerHTML = `<p style="color: red;">Failed to get page content. Error: ${error}<br><br>Please refresh the page and try again.</p>`;
    }
  }

  private async previewRawHTML(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      this.pageInfo.innerHTML = '<p style="color: red;">No active tab found.</p>';
      return;
    }

    try {
      const content = await chrome.tabs.sendMessage(tab.id, { action: 'getRawHTML' });

      if (content.error) {
        this.pageInfo.innerHTML = `<p style="color: red;">Error: ${content.error}</p>`;
        return;
      }

      // Escape HTML for display
      const escapedHTML = content.html
        .substring(0, 5000)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const preview = `
<strong>URL:</strong> ${content.url}
<strong>Title:</strong> ${content.title}
<strong>Total Length:</strong> ${content.length} chars

<strong>Raw HTML (first 5000 chars):</strong>
${escapedHTML}${content.length > 5000 ? '...' : ''}
      `.trim();

      this.pageInfo.innerHTML = `<pre style="white-space: pre-wrap; font-size: 10px; max-height: 300px; overflow-y: auto;">${preview}</pre>`;

      // Log full HTML to console
      console.log('[Preview] Raw HTML:', content);
    } catch (error) {
      console.error('[Preview] Error:', error);
      this.pageInfo.innerHTML = `<p style="color: red;">Failed to get raw HTML. Error: ${error}<br><br>Please refresh the page and try again.</p>`;
    }
  }

  private async activatePicker(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'activatePicker' });
      window.close();
    } catch (error) {
      this.addMessage('error', 'Failed to activate picker. Please refresh the page.');
    }
  }

  private async clearHistory(): Promise<void> {
    await chrome.runtime.sendMessage({ action: 'clearHistory' });
    this.messageList.innerHTML = '';
    this.addMessage('status', 'History cleared');
  }

  private async reconnect(): Promise<void> {
    await chrome.runtime.sendMessage({ action: 'reconnect' });
    this.addMessage('status', 'Reconnecting...');
  }

  private handleBackgroundMessage(message: any): void {
    if (message.action === 'streamUpdate') {
      this.handleStreamMessage(message.data);
    } else if (message.action === 'connectionStatusChanged') {
      this.updateConnectionStatus(message.status);
    }
  }

  private handleStreamMessage(msg: StreamMessage): void {
    switch (msg.type) {
      case 'text':
        if (msg.content) {
          this.addMessage('assistant', msg.content);
        }
        break;
      case 'tool':
        this.addMessage('tool', `Using tool: ${msg.tool}`);
        break;
      case 'error':
        this.addMessage('error', msg.content || 'An error occurred');
        break;
      case 'status':
        this.addMessage('status', msg.content || 'Processing...');
        break;
      case 'done':
        // Could add completion indicator
        break;
    }
  }

  private renderHistory(history: StreamMessage[]): void {
    // Group messages by requestId and render
    const byRequest = new Map<string, StreamMessage[]>();

    for (const msg of history) {
      const messages = byRequest.get(msg.requestId) || [];
      messages.push(msg);
      byRequest.set(msg.requestId, messages);
    }

    byRequest.forEach((messages) => {
      messages.forEach((msg) => {
        if (msg.type === 'text' && msg.content) {
          this.addMessage('assistant', msg.content, false);
        }
      });
    });
  }

  private addMessage(type: string, content: string, scroll = true): void {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = content;
    this.messageList.appendChild(div);

    if (scroll) {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }
  }

  private updateConnectionStatus(status: string): void {
    this.connectionStatus.className = `status-indicator ${status}`;
    this.connectionStatus.title = status.charAt(0).toUpperCase() + status.slice(1);
  }

  private displayVersionInfo(): void {
    const versionInfo = document.getElementById('version-info');
    if (versionInfo) {
      const buildTime = new Date().toISOString();
      const manifest = chrome.runtime.getManifest();
      versionInfo.textContent = `v${manifest.version} • Built: ${buildTime}`;
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new PopupController().init();
});
