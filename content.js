// content.js

async function initializeMentionExtension(inputField) {
  inputField.classList.add('mention-extension-enabled');

  inputField.addEventListener('keydown', (event) => {
    const menu = document.getElementById('mention-context-menu');
    if (menu) {
      console.log("preventing propagation")
      // Prevent events from reaching the input field when the menu is open
      event.stopImmediatePropagation();
      return;
    }
    // Check for Escape key
    if (event.key === 'Escape') {
      removeContextMenu();
      event.preventDefault(); // Prevent default action if necessary
      return; // Exit the function
    }
  }, true);

  inputField.addEventListener('keyup', handleKeyUp, true);

  const sendButtonObserver = new MutationObserver(async (mutations, observer) => {
    const selectors = getSelectors();
    const sendButton = document.querySelector(selectors.sendButton);
    
    if (sendButton && !sendButton.hasAttribute('data-mention-intercepted')) {
      sendButton.setAttribute('data-mention-intercepted', 'true');
      
      sendButton.addEventListener('click', async (event) => {
        if (event.isTrusted && sendButton.hasAttribute('data-mention-intercepted')) {
          handleSendButtonClick(event, sendButton);
        } else {
          console.log("skipping intercept submit clicked");
        }
      }, true);
    }
  });

// Start observing for the send button
sendButtonObserver.observe(document.body, {
  childList: true,
  subtree: true
});
  // Update keydown handler with capture phase
  inputField.addEventListener('keydown', async (event) => {
    const menu = document.getElementById('mention-context-menu');
    if (menu) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      } else if (event.key === 'Enter') {
        console.log("captured enter inside inputfield keydown")
        // Stop the event immediately with all available methods
        event.preventDefault();
        event.stopImmediatePropagation();
        
        const menuItems = document.querySelectorAll('.mention-menu-item');
        if (menuItems.length > 0 && currentMenuIndex >= 0) {
          const selectedItem = menuItems[currentMenuIndex];
          const suggestionLabel = selectedItem.innerText;
          
          const suggestions = await getSuggestions('') || [];
          const suggestion = Array.isArray(suggestions) 
            ? suggestions.find(s => s.label === suggestionLabel)
            : null;
          
          if (selectedItem && suggestion) {
            insertMentionContent(inputField, suggestion);
            removeContextMenu();
          }
        }
        return false;
      }
    }
  }, true);

  // Keep the keyup handler for other functionality
  //inputField.addEventListener('keyup', handleKeyUp);

  // Close context menu on click outside
  document.addEventListener('click', (event) => {
    const menu = document.getElementById('mention-context-menu');
    if (menu && !menu.contains(event.target)) {
      removeContextMenu();
    }
  });
}

// Initialize the observer
const observer = new MutationObserver(() => {
  const selectors = getSelectors();
  if (!selectors) return;

  const inputField = document.querySelector(selectors.inputField);
  if (inputField && !inputField.classList.contains('mention-extension-enabled')) {
    initializeMentionExtension(inputField);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initialize code block observer
const codeBlockObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check for both ChatGPT and Claude code blocks
          if (node.matches('pre code') || node.matches('.code-block__code')) {
            addCodeBlockButton(node, node.matches('pre code') ? 'chatgpt' : 'claude');
          }
          // Also check children
          const codeBlocks = node.querySelectorAll('pre code, .code-block__code');
          codeBlocks.forEach(codeBlock => {
            if (!codeBlock.dataset.buttonAdded) {
              addCodeBlockButton(
                codeBlock, 
                codeBlock.matches('pre code') ? 'chatgpt' : 'claude'
              );
            }
          });
        }
      });
    }
  });
});

// Start observing with the correct configuration
codeBlockObserver.observe(document.body, {
  childList: true,
  subtree: true
});

document.addEventListener('DOMContentLoaded', addButtonsToCodeBlocks);
setTimeout(addButtonsToCodeBlocks, 1000);
setInterval(addButtonsToCodeBlocks, 2000);

// Handle send button click
async function handleSendButtonClick(event, sendButton) {
  console.log("intercepted submit clicked");
  event.preventDefault();
  event.stopPropagation();

  const container = document.getElementById('file-chips-container');
  const fileChips = container ? container.querySelectorAll('.file-chip') : [];

  if (fileChips.length > 0) {
    try {
      const fileContents = await processFileChips(fileChips);
      await appendFileContentsToMessage(fileContents);
      await cleanupAndSendMessage(sendButton, container);
    } catch (error) {
      console.error('Error processing file contents:', error);
    }
  }
}

// Helper function to cleanup and send message
function cleanupAndSendMessage(sendButton, container) {
  if (container) {
    container.remove();
  }

  sendButton.removeAttribute('data-mention-intercepted');
  setTimeout(() => {
    sendButton.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    sendButton.setAttribute('data-mention-intercepted', 'true');
  }, 200); // needs delay to update the UI
}

// Insert mention content
async function insertMentionContent(suggestion) {
  const inputField = getInputField();
  const container = createChipsContainer(inputField);
  
  // Create and add chip immediately
  const chip = createFileChip(suggestion);
  container.appendChild(chip);

  if (!(suggestion.label in fileContentCache) && suggestion.type !== 'folder') {
    getFileContents(suggestion.label.slice(1))
      .then(content => {
        fileContentCache[suggestion.label] = content; // Use object notation
      })
      .catch(error => {
        console.error('Error caching file content:', error);
      });
  }

  // Clean up '>' character if present
  const currentText = inputField.value || inputField.innerText;
  if (currentText.endsWith('>')) {
    if (inputField.value) {
      inputField.value = currentText.slice(0, -1);
    } else {
      inputField.innerText = currentText.slice(0, -1);
    }
  }

  // Set cursor position
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(inputField);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  removeContextMenu();
}

// Get input field
function getInputField() {
  const selectors = getSelectors();
  return document.querySelector(selectors.inputField);
}
