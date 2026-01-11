/**
 * Element Picker - Interactive element selection overlay
 */

class ElementPicker {
  private overlay: HTMLDivElement | null = null;
  private highlightBox: HTMLDivElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private isActive = false;

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'claude-picker-overlay';
    this.overlay.innerHTML = `
      <div class="claude-picker-toolbar">
        <span>Click an element to analyze with Claude</span>
        <button id="claude-picker-cancel">Cancel (Esc)</button>
      </div>
    `;

    // Add overlay styles
    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      pointerEvents: 'all'
    });

    document.body.appendChild(this.overlay);

    // Style toolbar
    this.toolbar = this.overlay.querySelector('.claude-picker-toolbar') as HTMLDivElement;
    Object.assign(this.toolbar.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1e1e1e',
      color: '#d4d4d4',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      display: 'flex',
      gap: '15px',
      alignItems: 'center',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: '2147483648'
    });

    // Style cancel button
    const cancelBtn = this.toolbar.querySelector('#claude-picker-cancel') as HTMLButtonElement;
    Object.assign(cancelBtn.style, {
      background: '#f48771',
      color: 'white',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px'
    });

    // Create highlight box
    this.highlightBox = document.createElement('div');
    this.highlightBox.id = 'claude-highlight-box';
    Object.assign(this.highlightBox.style, {
      position: 'absolute',
      display: 'none',
      border: '2px solid #4ec9b0',
      background: 'rgba(78, 201, 176, 0.15)',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'all 0.1s ease'
    });
    document.body.appendChild(this.highlightBox);

    // Attach event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeydown);
    cancelBtn.addEventListener('click', () => this.deactivate());
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isActive || !this.highlightBox) return;

    const target = e.target as HTMLElement;
    if (this.isPickerElement(target)) {
      this.highlightBox.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    Object.assign(this.highlightBox.style, {
      display: 'block',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.isActive) return;

    const target = e.target as HTMLElement;

    // Ignore clicks on picker UI
    if (this.isPickerElement(target)) {
      if (target.id === 'claude-picker-cancel') {
        return; // Let the button click handler deal with it
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const content = this.extractContent(target);
    this.sendToBackground(content);
    this.deactivate();
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isActive) {
      this.deactivate();
    }
  };

  private isPickerElement(element: HTMLElement): boolean {
    return !!(
      element.id === 'claude-picker-overlay' ||
      element.id === 'claude-highlight-box' ||
      element.closest('#claude-picker-overlay')
    );
  }

  private extractContent(element: HTMLElement): any {
    const tagName = element.tagName.toLowerCase();

    // Handle different element types
    if (tagName === 'table') {
      return this.parseTable(element as HTMLTableElement);
    }
    if (tagName === 'ul' || tagName === 'ol') {
      return this.parseList(element);
    }
    if (tagName === 'pre' || tagName === 'code') {
      return this.parseCodeBlock(element);
    }

    return {
      url: window.location.href,
      selector: this.getSelector(element),
      tagName,
      elementType: 'text',
      content: element.innerText || element.textContent || '',
      html: element.outerHTML.substring(0, 5000)
    };
  }

  private parseTable(table: HTMLTableElement): any {
    const rows: string[][] = [];
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const cells: string[] = [];
      for (let j = 0; j < row.cells.length; j++) {
        cells.push(row.cells[j].innerText.trim());
      }
      rows.push(cells);
    }

    return {
      url: window.location.href,
      selector: this.getSelector(table),
      tagName: 'table',
      elementType: 'table',
      content: JSON.stringify(rows),
      structured: { rows }
    };
  }

  private parseList(element: HTMLElement): any {
    const items: string[] = [];
    const listItems = element.querySelectorAll('li');
    listItems.forEach((li) => {
      items.push(li.innerText.trim());
    });

    return {
      url: window.location.href,
      selector: this.getSelector(element),
      tagName: element.tagName.toLowerCase(),
      elementType: 'list',
      content: items.join('\n'),
      structured: { items }
    };
  }

  private parseCodeBlock(element: HTMLElement): any {
    return {
      url: window.location.href,
      selector: this.getSelector(element),
      tagName: element.tagName.toLowerCase(),
      elementType: 'code',
      content: element.textContent || '',
      language: element.className.match(/language-(\w+)/)?.[1] || 'unknown'
    };
  }

  private getSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;

    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className) {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('claude-'));
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private sendToBackground(content: any): void {
    const message = {
      type: 'element_content',
      id: `element-${Date.now()}`,
      timestamp: Date.now(),
      payload: {
        ...content,
        instruction: `Analyze this ${content.elementType} element from the page: ${content.selector}`
      }
    };

    chrome.runtime.sendMessage({
      action: 'sendCommand',
      payload: message
    });

    console.log('[Element Picker] Sent element content to background');
  }

  deactivate(): void {
    if (!this.isActive) return;

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeydown);

    this.overlay?.remove();
    this.highlightBox?.remove();

    this.overlay = null;
    this.highlightBox = null;
    this.toolbar = null;
    this.isActive = false;

    console.log('[Element Picker] Deactivated');
  }
}

// Global instance
let pickerInstance: ElementPicker | null = null;

// Export for content script
export function activateElementPicker(): void {
  if (!pickerInstance) {
    pickerInstance = new ElementPicker();
  }
  pickerInstance.activate();
}

export function deactivateElementPicker(): void {
  pickerInstance?.deactivate();
}
