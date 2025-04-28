document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchText');
  const replaceInput = document.getElementById('replaceText');
  const replaceBtn = document.getElementById('replaceBtn');
  const statusDiv = document.getElementById('status');
  const useRegexCheckbox = document.getElementById('useRegex');
  const elementsCheckedSpan = document.getElementById('elementsChecked');
  const replacementsCountSpan = document.getElementById('replacementsCount');

  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${isError ? 'error' : 'success'}`;
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  async function isContentScriptReady(tabId) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkContentScript', tabId }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError });
          } else {
            resolve(response || { success: false });
          }
        });
      });
      return response.success;
    } catch (error) {
      console.error('Error checking content script status:', error);
      return false;
    }
  }

  async function injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(true);
        }
      });
    });
  }

  replaceBtn.addEventListener('click', async () => {
    const searchText = searchInput.value.trim();
    const replaceText = replaceInput.value;

    if (!searchText) {
      showStatus('Please enter text to search for', true);
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      // Check if content script is ready
      let isReady = await isContentScriptReady(tab.id);
      if (!isReady) {
        try {
          await injectContentScript(tab.id);
          // Wait for the script to initialize with multiple retries
          for (let i = 0; i < 3; i++) {
            await new Promise(res => setTimeout(res, 1000));
            isReady = await isContentScriptReady(tab.id);
            if (isReady) break;
          }
        } catch (injectErr) {
          showStatus('Failed to inject content script: ' + injectErr, true);
          return;
        }
      }
      if (!isReady) {
        showStatus('Please refresh the page and try again', true);
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'replaceText',
        searchText,
        replaceText,
        useRegex: useRegexCheckbox.checked
      });

      if (response.success) {
        const message = response.count > 0 
          ? `Replaced ${response.count} occurrence${response.count > 1 ? 's' : ''}` 
          : 'No matches found';
        showStatus(message, response.count === 0);
        
        // Update info display
        elementsCheckedSpan.textContent = response.elementsChecked || 0;
        replacementsCountSpan.textContent = response.count || 0;
      } else if (response.error) {
        showStatus(`Error: ${response.error}`, true);
        elementsCheckedSpan.textContent = '0';
        replacementsCountSpan.textContent = '0';
      } else {
        showStatus('No matches found', true);
        elementsCheckedSpan.textContent = '0';
        replacementsCountSpan.textContent = '0';
      }
    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: Could not perform replacement. Please refresh the page.', true);
    }
  });
});