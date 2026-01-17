// Content script for page interaction
import { activateElementPicker } from './element-picker';
import { parsePage } from './page-parser';

console.log('[Content Script] Loaded');

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content Script] Received message:', request.action);

  switch (request.action) {
    case 'getPageContent':
      try {
        // Use Readability for clean content extraction
        const parsed = parsePage();
        console.log('[Content Script] Parsed page, length:', parsed.length);
        sendResponse({
          url: parsed.url,
          title: parsed.title,
          content: parsed.textContent,  // Clean text content
          selectedText: parsed.selectedText,
          excerpt: parsed.excerpt,
          byline: parsed.byline,
          siteName: parsed.siteName,
          length: parsed.length,
        });
      } catch (error) {
        console.error('[Content Script] Error parsing page:', error);
        sendResponse({ error: String(error) });
      }
      break;

    case 'getRawHTML':
      try {
        const html = document.documentElement.outerHTML;
        console.log('[Content Script] Raw HTML length:', html.length);
        sendResponse({
          url: window.location.href,
          title: document.title,
          html: html,
          length: html.length,
        });
      } catch (error) {
        console.error('[Content Script] Error getting raw HTML:', error);
        sendResponse({ error: String(error) });
      }
      break;

    case 'activatePicker':
      console.log('[Content Script] Activating element picker');
      activateElementPicker();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});
