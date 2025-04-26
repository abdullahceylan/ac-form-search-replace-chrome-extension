// Background service worker to handle extension initialization and message passing
let contentScriptStatus = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle content script ready messages and track connection status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'contentScriptReady' && sender.tab) {
    contentScriptStatus.set(sender.tab.id, true);
    sendResponse({ status: 'acknowledged', success: true });
    return true;
  }
  
  // Handle content script status check from popup
  if (message.action === 'checkContentScript') {
    sendResponse({ success: contentScriptStatus.has(message.tabId) });
    return true;
  }
});

// Reset connection status when tab is updated
chrome.tabs.onUpdated.addListener((tabId) => {
  if (contentScriptStatus.has(tabId)) {
    contentScriptStatus.delete(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (contentScriptStatus.has(tabId)) {
    contentScriptStatus.delete(tabId);
  }
});