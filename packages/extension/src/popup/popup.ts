import type { ClientMessage, StreamMessage } from '@claude-bridge/shared';

class PopupController {
  private messageList: HTMLElement;
  private commandInput: HTMLTextAreaElement;
  private connectionStatus: HTMLElement;
  private pageInfo: HTMLElement;

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
  }

  private bindEvents(): void {
    // Send button
    document.getElementById('send-btn')!.addEventListener('click', () => this.sendCommand());

    // Pick element buttons
    document.getElementById('pick-element-btn')!.addEventListener('click', () => this.activatePicker());
    document.getElementById('pick-element-btn-2')!.addEventListener('click', () => this.activatePicker());

    // Page analysis buttons
    document.getElementById('preview-page-btn')!.addEventListener('click', () => this.previewPage());
    document.getElementById('preview-raw-btn')!.addEventListener('click', () => this.previewRawHTML());
    document.getElementById('analyze-page-btn')!.addEventListener('click', () => this.analyzePage());
    document.getElementById('analyze-selection-btn')!.addEventListener('click', () => this.analyzeSelection());

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

    const message: ClientMessage = {
      type: 'command',
      id: `popup-${Date.now()}`,
      timestamp: Date.now(),
      payload: {
        instruction,
        url: tab?.url,
        title: tab?.title,
      },
    };

    // Add user message to UI immediately
    this.addMessage('user', instruction);
    this.commandInput.value = '';

    // Send to background
    chrome.runtime.sendMessage({ action: 'sendCommand', payload: message });
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

  private async analyzePage(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    try {
      const content = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });

      const message: ClientMessage = {
        type: 'page_content',
        id: `page-${Date.now()}`,
        timestamp: Date.now(),
        payload: content,
      };

      this.addMessage('user', `Analyzing page: ${content.title}`);
      chrome.runtime.sendMessage({ action: 'sendCommand', payload: message });
    } catch (error) {
      this.addMessage('error', 'Failed to get page content. Please refresh the page.');
    }
  }

  private async analyzeSelection(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    try {
      const content = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });

      if (!content.selectedText) {
        this.addMessage('error', 'No text selected. Please select some text first.');
        return;
      }

      const message: ClientMessage = {
        type: 'page_content',
        id: `selection-${Date.now()}`,
        timestamp: Date.now(),
        payload: {
          url: content.url,
          title: content.title,
          content: content.selectedText,
          selectedText: content.selectedText,
        },
      };

      this.addMessage('user', `Analyzing selection: "${content.selectedText.substring(0, 50)}..."`);
      chrome.runtime.sendMessage({ action: 'sendCommand', payload: message });
    } catch (error) {
      this.addMessage('error', 'Failed to get selection. Please refresh the page.');
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
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  new PopupController().init();
});
