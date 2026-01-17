import { describe, it, expect, vi, beforeEach } from 'vitest';

// Example utility function for extension
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

describe('Extension utilities', () => {
  describe('formatTimestamp', () => {
    it('should format timestamp to time string', () => {
      const timestamp = new Date('2024-01-01T12:30:45').getTime();
      const formatted = formatTimestamp(timestamp);

      // Just check it returns a string (locale-dependent)
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncateText(text, 20)).toBe('Short text');
    });

    it('should truncate long text with ellipsis', () => {
      const text = 'This is a very long text that needs truncation';
      const result = truncateText(text, 20);

      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should handle exact length match', () => {
      const text = 'Exact';
      expect(truncateText(text, 5)).toBe('Exact');
    });
  });
});

// Example test for Chrome API interaction
describe('Chrome API interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send message via chrome.runtime', () => {
    const message = { type: 'test', data: 'hello' };

    chrome.runtime.sendMessage(message);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledOnce();
  });

  it('should query tabs', async () => {
    const mockTabs = [{ id: 1, url: 'https://example.com' }];
    chrome.tabs.query.mockResolvedValue(mockTabs);

    const result = await chrome.tabs.query({ active: true });

    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true });
    expect(result).toEqual(mockTabs);
  });

  it('should store data in chrome.storage.local', async () => {
    const data = { key: 'value' };
    chrome.storage.local.set.mockResolvedValue(undefined);

    await chrome.storage.local.set(data);

    expect(chrome.storage.local.set).toHaveBeenCalledWith(data);
  });
});
