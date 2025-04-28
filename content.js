// Initialize content script and notify background
let isInitialized = false;

function initializeContentScript() {
  return new Promise((resolve) => {
    const tryInit = () => {
      chrome.runtime.sendMessage(
        { action: "contentScriptReady" },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            console.log("Retrying initialization...");
            setTimeout(tryInit, 1000);
            return;
          }
          isInitialized = true;
          console.log("Content script initialized");
          resolve(true);
        }
      );
    };
    tryInit();
  });
}

// Initialize content script and wait for completion
(async () => {
  try {
    await initializeContentScript();
  } catch (error) {
    console.error("Failed to initialize content script:", error);
  }
})();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isInitialized) {
    sendResponse({
      success: false,
      error: "Content script not yet initialized",
    });
    return true;
  }
  if (request.action === "replaceText") {
    try {
      if (!request.searchText || typeof request.searchText !== "string") {
        throw new Error("Invalid search text");
      }
      if (typeof request.replaceText !== "string") {
        throw new Error("Invalid replace text");
      }
      if (typeof request.useRegex !== "boolean") {
        request.useRegex = false;
      }

      const result = findAndReplace(request.searchText, request.replaceText, request.useRegex);
      sendResponse({ success: true, ...result });
    } catch (error) {
      console.error("Content script error:", error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep the message channel open for async response
});

function findAndReplace(searchText, replaceText, useRegex = false) {
  try {
    // Get all input and textarea elements
    const formElements = document.querySelectorAll(
      'input[type="text"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], textarea'
    );

    if (formElements.length === 0) {
      return { success: false, error: "No form elements found on page" };
    }

    let replacementCount = 0;
    let elementsChecked = 0;

    // Create regex pattern if useRegex is true
    let searchPattern;
    if (useRegex) {
      try {
        searchPattern = new RegExp(searchText, 'g');
      } catch (regexError) {
        return { success: false, error: "Invalid regular expression: " + regexError.message };
      }
    }

    formElements.forEach((element) => {
      try {
        if (element.value) {
          let newValue;
          let matches = 0;

          if (useRegex) {
            // Use regex replacement
            if (element.value.match(searchPattern)) {
              newValue = element.value.replace(searchPattern, replaceText);
              matches = (element.value.match(searchPattern) || []).length;
            }
          } else {
            // Use simple string replacement
            if (element.value.includes(searchText)) {
              newValue = element.value.split(searchText).join(replaceText);
              matches = element.value.split(searchText).length - 1;
            }
          }

          // Only update if there was actually a change
          if (newValue && newValue !== element.value) {
            element.value = newValue;

            // Trigger input event to ensure any listeners are notified
            const event = new Event("input", { bubbles: true });
            element.dispatchEvent(event);

            replacementCount += matches;
          }
        }
        elementsChecked++;
      } catch (elementError) {
        console.error("Error processing element:", elementError);
      }
    });

    return {
      success: replacementCount > 0,
      count: replacementCount,
      elementsChecked,
    };
  } catch (error) {
    console.error("Error in findAndReplace:", error);
    return { success: false, error: error.message };
  }
}
