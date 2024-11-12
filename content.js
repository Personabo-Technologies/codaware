// content.js
const PLATFORMS = {
  CHATGPT: {
    hostnames: ['chat.openai.com', 'chatgpt.com'],
    selectors: {
      inputField: '#prompt-textarea',
      sendButton: '[data-testid="send-button"]',
      editor: '.ProseMirror'
    },
    inputFieldType: 'textarea'
  },
  CLAUDE: {
    hostnames: ['claude.ai'],
    selectors: {
      inputField: '[contenteditable="true"].ProseMirror',
      sendButton: 'button[aria-label="Send Message"]',
      editor: '.ProseMirror'
    },
    inputFieldType: 'contenteditable'
  }
};

function getFileContents(filePath) {
  filePath = filePath.trim();
  return new Promise((resolve, reject) => {
    console.log('Sending request for file:', filePath);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout requesting file: ${filePath}`));
    }, 10000); // 10 second timeout

    chrome.runtime.sendMessage(
      { type: 'GET_FILE_CONTENTS', filePath },
      response => {
        clearTimeout(timeout);
        
        // Check for runtime errors first
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        // Check if response exists
        if (!response) {
          console.error('No response received for:', filePath);
          reject(new Error('No response received'));
          return;
        }

        if (response.error) {
          console.error('Error in response:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('Received response for:', filePath);
          resolve(response.content);
        }
      }
    );
  });
}

function getSuggestions(query) {
  return new Promise((resolve, reject) => {  // Added reject parameter
    try {
      chrome.storage.local.get(['filePaths'], (result) => {
        // Check for chrome.runtime.lastError
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const files = result.filePaths || [];
      
      const suggestions = [
        { label: 'problems', type: 'special' },
        ...files.map(file => ({
          label: '/' + file,
          type: file.endsWith('/') ? 'folder' : 'file'
        }))
      ];

      if (!query) {
        resolve(suggestions);
        return;
      }

      const lowerQuery = query.toLowerCase();
      resolve(suggestions.filter(item => 
        item.label.toLowerCase().includes(lowerQuery)
      ));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function shouldShowContextMenu(text, index) {
  // Ensure there's no whitespace between '>' and the cursor
  const textAfterArrow = text.slice(index + 1);
  return !/\s/.test(textAfterArrow);
}

let currentMenuIndex = 0; // Track the currently highlighted menu item

function handleKeyUp(event) {
  console.log(`handleKeyUp called. Key: ${event.key}`);
  const inputField = event.target;

  // Get the current selection
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  
  // Get the current node (text node) where the cursor is
  const currentNode = range.startContainer;
  
  // If we're not in a text node, or if we're at a different node than the current line
  if (currentNode.nodeType !== Node.TEXT_NODE) {
    console.log('Current node is not a text node. Removing context menu.');
    removeContextMenu();
    return;
  }

  // Check if the context menu is open first
  const menu = document.getElementById('mention-context-menu');
  if (menu && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    console.log(`Navigating menu with key: ${event.key}`);
    event.preventDefault();
    event.stopPropagation();
    navigateMenu(event.key);
    return;
  }

  // Only look at the text content of the current line (node)
  const textContent = currentNode.textContent;
  const cursorPosition = range.startOffset;
  const textBeforeCursor = textContent.slice(0, cursorPosition);

  // Check if the last character is '>'
  const lastIndex = textBeforeCursor.lastIndexOf('>');
  if (lastIndex !== -1 && shouldShowContextMenu(textBeforeCursor, lastIndex)) {
    const query = textBeforeCursor.slice(lastIndex + 1);
    console.log(`Triggering context menu with query: ${query.trim()}`);
    showContextMenu(inputField, range, query.trim());
  } else {
    console.log('No context menu trigger found. Removing context menu.');
    removeContextMenu();
  }
}

function navigateMenu(direction) {
  const menuItems = document.querySelectorAll('.mention-menu-item');
  const menu = document.getElementById('mention-context-menu');
  console.log("menuItem length " + menuItems.length);
  if (menuItems.length === 0) return;

  // Clear previous highlight
  if (currentMenuIndex >= 0) {
    menuItems[currentMenuIndex].classList.remove('highlighted');
  }

  // Update the index based on the direction
  if (direction === 'ArrowDown') {
    currentMenuIndex = (currentMenuIndex + 1) % menuItems.length; // Loop to the start
  } else if (direction === 'ArrowUp') {
    currentMenuIndex = (currentMenuIndex - 1 + menuItems.length) % menuItems.length; // Loop to the end
  }

  console.log("Current menu index: " + currentMenuIndex);

  // Highlight the current menu item
  const currentItem = menuItems[currentMenuIndex];
  currentItem.classList.add('highlighted');

  // Scroll the highlighted item into view
  const itemHeight = currentItem.offsetHeight;
  const menuHeight = menu.offsetHeight;
  const itemTop = currentItem.offsetTop;
  const scrollTop = menu.scrollTop;

  // If item is below visible area
  if (itemTop + itemHeight > scrollTop + menuHeight) {
    menu.scrollTop = itemTop + itemHeight - menuHeight;
  }
  // If item is above visible area
  else if (itemTop < scrollTop) {
    menu.scrollTop = itemTop;
  }
}

async function showContextMenu(inputField, range, query) {
  removeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'mention-context-menu';

  // First append the menu so we can get its height
  document.body.appendChild(menu);

  // Get the input field dimensions
  const inputRect = inputField.getBoundingClientRect();
  
  // Position the menu above the input field, fixed position
  const menuTop = inputRect.top - 20;
  const menuLeft = inputRect.left;

  // Set the menu position using CSS variable
  menu.style.setProperty('--menu-top', `${menuTop}px`);
  menu.style.left = `${menuLeft}px`;

  // Set the width of the menu to match the input field
  menu.style.width = `${inputRect.width}px`;
  menu.style.height = '150px';
  menu.style.overflowY = 'auto';

  // Get suggestions
  const suggestions = await getSuggestions(query);

  if (suggestions.length === 0) {
    const item = document.createElement('div');
    item.className = 'mention-menu-item no-results';
    item.innerText = 'No results found';
    menu.appendChild(item);
  } else {
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'mention-menu-item';
      item.innerText = suggestion.label;

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      item.addEventListener('click', () => {
        insertMentionContent(inputField, suggestion);
        removeContextMenu();
      });

      menu.appendChild(item);

      // Highlight the first item by default
      if (index === 0) {
        currentMenuIndex = 0; // Set the current menu index to the first item
        item.classList.add('highlighted'); // Highlight the first item
      }
    });
  }

  document.body.appendChild(menu);
}

function insertMentionContent(inputField, suggestion) {
  // Create or get the chips container
  const container = createChipsContainer(inputField);
  
  // Add the new chip
  const chip = createFileChip(suggestion);
  container.appendChild(chip);

  // Get the current selection and range
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const currentNode = range.startContainer;
  
  // Find the position of the last '>' symbol before the cursor
  const textContent = currentNode.textContent;
  const cursorPosition = range.startOffset;
  const textBeforeCursor = textContent.slice(0, cursorPosition); 
  const lastArrowIndex = textBeforeCursor.lastIndexOf('>');

  // Remove the existing query text 
  const startOffset = lastArrowIndex + 1;
  const endOffset = cursorPosition;

  // Create a new range to replace the text
  const newRange = document.createRange();
  newRange.setStart(currentNode, startOffset);
  newRange.setEnd(currentNode, endOffset);
  newRange.deleteContents();

  // Create a styled span element for the mention
  const mentionSpan = document.createElement('span');
  mentionSpan.className = 'mention-highlight';
  mentionSpan.innerText = suggestion.label + ' ';
  newRange.insertNode(mentionSpan);

  // Move the cursor after the inserted text
  newRange.setStartAfter(mentionSpan);
  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);

  // Platform-specific event dispatch
  const platform = getCurrentPlatform();
  const event = platform.inputFieldType === 'contenteditable'
    ? new InputEvent('input', { bubbles: true, cancelable: true })
    : new Event('input', { bubbles: true });
  
  inputField.dispatchEvent(event);
}

function removeContextMenu() {
  const existingMenu = document.getElementById('mention-context-menu');
  if (existingMenu) {
    existingMenu.parentNode.removeChild(existingMenu);
  }
}

// Updated helper functions
function getCurrentPlatform() {
  const currentHostname = window.location.hostname;
  return Object.values(PLATFORMS).find(platform => 
    platform.hostnames.some(hostname => 
      currentHostname.includes(hostname)
    )
  );
}

function getPlatformById(platformId) {
  return PLATFORMS[platformId];
}

function getSelectors() {
  const platform = getCurrentPlatform();
  return platform ? platform.selectors : null;

}
// Initialize when the element is found
// Helper function to process file chips
async function processFileChips(fileChips) {
  console.log('Processing file chips:', fileChips.length);
  return Promise.all(
    Array.from(fileChips).map(async chip => {
      const label = chip.textContent.split('×')[0].trim().slice(2).trim();
      console.log('Requesting content for:', label);
      try {
        const content = await getFileContents(label);
        console.log('Received content for:', label);
        return `File: ${label}\n\`\`\`\n${content}\n\`\`\`\n`;
      } catch (error) {
        console.error('Error getting content for', label, error);
        return `File: ${label}\n\`\`\`\nError loading file content\n\`\`\`\n`;
      }
    })
  );
}

// Helper function to append file contents to message
async function appendFileContentsToMessage(fileContents) {
  const platform = getCurrentPlatform();
  const editor = document.querySelector(platform.selectors.editor);
  const currentText = editor.innerText;
  const newText = `${currentText}\n\nReferenced Files:\n${fileContents.join('\n')}`;

  const lineProcessor = line => `<p>${line || '<br>'}</p>`;
  editor.innerHTML = newText.split('\n').map(lineProcessor).join('');

  // Dispatch appropriate input event based on platform
  const event = platform.inputFieldType === 'contenteditable' 
    ? new InputEvent('input', { bubbles: true, cancelable: true })
    : new Event('input', { bubbles: true });
  
  editor.dispatchEvent(event);
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

async function initializeMentionExtension(inputField) {
  inputField.classList.add('mention-extension-enabled');

  // Add comprehensive event interception for claude.ai
  if (getCurrentPlatform()?.hostnames.includes('claude.ai')) {
    const interceptEnterKey = (event) => {
      const menu = document.getElementById('mention-context-menu');
      if (menu && (event.key === 'Enter' || event.inputType === 'insertParagraph')) {
        console.log(`Intercepted ${event.type} event. Key: ${event.key}, InputType: ${event.inputType}`);
        event.preventDefault();
        event.stopImmediatePropagation();
        // Clear any pending composition
        if (window.getSelection) {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            selection.removeAllRanges();
          }
        }
        return false;
      }
    };

    // Intercept keydown, keypress, keyup, beforeinput, and input at the document level
    ['keydown', 'keypress', 'keyup', 'beforeinput', 'input'].forEach((eventType) => {
      document.addEventListener(eventType, interceptEnterKey, { capture: true });
    });
  }
  

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

if (getCurrentPlatform()?.hostnames.includes('claude.ai')) {
  document.addEventListener('keydown', (event) => {
    const menu = document.getElementById('mention-context-menu');
    if (menu && event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);
}
  // Update keydown handler with capture phase
  inputField.addEventListener('keydown', async (event) => {
    const menu = document.getElementById('mention-context-menu');
    if (menu) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      } else if (event.key === 'Enter') {
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
  inputField.addEventListener('keyup', handleKeyUp);

  // Close context menu on click outside
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#mention-context-menu')) {
      removeContextMenu();
    }
  });
}

// Add functions to create and manage chips
function createChipsContainer(inputField) {
  let container = document.getElementById('file-chips-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'file-chips-container';
    container.style.cssText = `
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    `;
    inputField.parentNode.insertBefore(container, inputField);
  }
  return container;
}

function createFileChip(suggestion) {
  const chip = document.createElement('div');
  chip.className = 'file-chip';
  chip.style.cssText = `
    background: #2A2B32;
    border: 1px solid #565869;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  `;
  
  const icon = suggestion.type === 'folder' ? '📁' : '📄';
  chip.textContent = `${icon} ${suggestion.label}`;
  
  const removeBtn = document.createElement('span');
  removeBtn.textContent = '×';
  removeBtn.style.marginLeft = '4px';
  removeBtn.style.cursor = 'pointer';
  removeBtn.onclick = () => chip.remove();
  chip.appendChild(removeBtn);
  
  return chip;
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

// Global event logging to debug event flow
['keydown', 'keypress', 'keyup', 'beforeinput', 'input'].forEach(eventType => {
  document.addEventListener(eventType, (event) => {
    console.log(`Global Event Listener - Event: ${eventType}, Key: ${event.key}, InputType: ${event.inputType}`);
  }, true);
});
