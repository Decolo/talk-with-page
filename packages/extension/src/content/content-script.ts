// Content script for page interaction
import { activateElementPicker } from './element-picker';

console.log('[Content Script] Loaded');

// Listen for messages from popup/background
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
      console.log('[Content Script] Activating element picker');
      activateElementPicker();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});
