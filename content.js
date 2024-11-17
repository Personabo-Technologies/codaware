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

async function getFileContents(filePath, retryCount = 3) {
  filePath = filePath.trim();
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        console.log(`Attempt ${attempt}: Sending request for file:`, filePath);
        
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout requesting file: ${filePath}`));
        }, 10000);

        chrome.runtime.sendMessage(
          { type: 'GET_FILE_CONTENTS', filePath },
          response => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }

            if (!response) {
              reject(new Error('No response received'));
              return;
            }

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.content);
            }
          }
        );
      });
    } catch (error) {
      if (attempt === retryCount) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
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
  // Extract text before and after the '>' character
  const textBeforeArrow = text.slice(0, index);
  const textAfterArrow = text.slice(index + 1);

  // Check if there's no non-whitespace character after '>'
  const noTrailingString = !/\S/.test(textAfterArrow);

  // Check if the '>' is at the start or immediately preceded by a whitespace
  const hasWhiteSpaceImmediatelyBefore =
    index === 0 || /\s/.test(text[index - 1]);

  // Decide whether to show the context menu
  return noTrailingString && hasWhiteSpaceImmediatelyBefore;
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
  const shouldShowFileSuggestions = shouldShowContextMenu(textBeforeCursor, lastIndex);
  if (lastIndex !== -1 && shouldShowFileSuggestions) {
    console.log("should show context menu")
    const query = textBeforeCursor.slice(lastIndex + 1);
    console.log(`Triggering context menu with query: ${query.trim()}`);
    showContextMenu(inputField, range, query.trim());
  } else {
    console.log('No context menu trigger found. Removing context menu.');
    removeContextMenu();
  }
}

function navigateMenu(direction, menuItems) {
  if (menuItems.length === 0) return;

  // Clear previous highlight
  if (currentMenuIndex >= 0 && menuItems[currentMenuIndex]) {
    menuItems[currentMenuIndex].classList.remove('highlighted');
  }

  // Update the index based on the direction
  if (direction === 'ArrowDown') {
    currentMenuIndex = (currentMenuIndex + 1) % menuItems.length;
  } else if (direction === 'ArrowUp') {
    currentMenuIndex = (currentMenuIndex - 1 + menuItems.length) % menuItems.length;
  }

  // Highlight the current menu item
  const currentItem = menuItems[currentMenuIndex];
  currentItem.classList.add('highlighted');

  // Scroll the highlighted item into view
  currentItem.scrollIntoView({ block: 'nearest' });
}

function handleMenuInputKeyDown(event, menuInput, menu) {
  const menuItems = menu.querySelectorAll('.mention-menu-item');

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateMenu('ArrowDown', menuItems);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateMenu('ArrowUp', menuItems);
  } else if (event.key === 'Enter') {
    console.log("Captured Enter inside FileMenu")
    event.preventDefault();
    if (currentMenuIndex >= 0 && menuItems[currentMenuIndex]) {
      const selectedItem = menuItems[currentMenuIndex];
      const suggestionLabel = selectedItem.innerText;
      getSuggestions('').then((suggestions) => {
        const suggestion = suggestions.find(s => s.label === suggestionLabel);
        if (suggestion) {
          insertMentionContent(suggestion);
          //removeContextMenu();
        }
      });
    }
  } else if (event.key === 'Escape') {
    removeContextMenu();
  }
}

async function showContextMenu(inputField, range, query) {
  removeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'mention-context-menu';

  // Create the input field inside the context menu
  const menuInput = document.createElement('input');
  menuInput.type = 'text';
  menuInput.id = 'menu-input';
  menuInput.value = query;
  menuInput.placeholder = 'Search files...';
  menuInput.className = 'menu-input';

  // Create a suggestions container
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = 'suggestions-container';
  
  // Append both elements to the menu
  menu.appendChild(menuInput);
  menu.appendChild(suggestionsContainer);
  document.body.appendChild(menu);

  // Position the menu
  const inputRect = inputField.getBoundingClientRect();
  const menuTop = inputRect.top - 20;
  const menuLeft = inputRect.left;

  menu.style.setProperty('--menu-top', `${menuTop}px`);
  menu.style.left = `${menuLeft}px`;
  menu.style.width = `${inputRect.width}px`;
  menu.style.maxHeight = '200px';
  menu.style.overflowY = 'auto';
  menu.style.border = '1px solid #ccc';
  menu.style.zIndex = '1000';

  // Focus on the menu input
  menuInput.focus();

  // Initial suggestions
  await updateSuggestions(suggestionsContainer, query);

  // Add event listeners
  menuInput.addEventListener('input', async (event) => {
    currentMenuIndex = 0;
    await updateSuggestions(suggestionsContainer, event.target.value);
  });

  menuInput.addEventListener('keydown', (event) => {
    handleMenuInputKeyDown(event, menuInput, menu);
  });
}

async function updateSuggestions(menu, query) {
  // Remove existing suggestion items
  menu.innerHTML = '';
  
  // Fetch new suggestions
  const suggestions = await getSuggestions(query);

  if (suggestions.length === 0) {
    const item = document.createElement('div');
    item.className = 'mention-menu-item no-results';
    item.innerText = 'No results found';
    menu.appendChild(item);
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'mention-menu-item';
    item.innerText = suggestion.label;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    item.addEventListener('click', () => {
      insertMentionContent(document.querySelector(getSelectors().inputField), suggestion);
      //removeContextMenu();
    });

    menu.appendChild(item);

    if (index === currentMenuIndex) {
      item.classList.add('highlighted');
    }
  });
}

function getInputField() {
  const selectors = getSelectors();
  return document.querySelector(selectors.inputField);
}

function insertMentionContent(suggestion) {
  const inputField = getInputField();

  // Create or get the chips container
  const container = createChipsContainer(inputField);
  
  // Add the new chip
  const chip = createFileChip(suggestion);
  container.appendChild(chip);

  // Check if the last character is '>' and remove it
  const currentText = inputField.value || inputField.innerText; // Get current text
  if (currentText.endsWith('>')) {
    if (inputField.value) {
      inputField.value = currentText.slice(0, -1); // For textarea
    } else {
      //TODO: Claude.ai bug where setting the innerText cause prosemirror to break. Doesn't break on chatgpt
      inputField.innerText = currentText.slice(0, -1); // For contenteditable
    }
  }

    // Set cursor position to the end of the input field
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(inputField);
    range.collapse(false); // Collapse to the end
    selection.removeAllRanges();
    selection.addRange(range);
  
  // Close the context menu after inserting the chip
  removeContextMenu();
}

function removeContextMenu() {
  const existingMenu = document.getElementById('mention-context-menu');
  if (existingMenu) {
    existingMenu.parentNode.removeChild(existingMenu);
    // Return focus to the original input field
    const inputField = getInputField();
    inputField.focus();
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
    border-radius: 10px;
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

// Function to add button to code blocks
function addCodeBlockButton(codeBlock) {
  if (codeBlock.dataset.buttonAdded) return;

  // Find the existing sticky div containing the Copy Code button
  const stickyDiv = codeBlock.closest('pre').querySelector('.sticky');
  if (!stickyDiv) return;

  // Create log button
  const applyButton = document.createElement('button');
  applyButton.innerHTML = '📋 Apply Change';
  applyButton.style.cssText = `
    padding: 4px 8px;
    background: #2A2B32;
    border: 1px solid #565869;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 12px;
    margin-right: 8px; /* Add space between buttons */
  `;

  applyButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    let code = codeBlock.textContent;
    console.log('Code block content:', code);
    
    const applyDestination = `client/src/shared/utils/toast.js`;

    // Send message to background script with both filename and code
    chrome.runtime.sendMessage({
      type: 'APPLY_DIFF',
      fileName: applyDestination,
      code: code  // Include the code to be applied
    }, (response) => {
      if (response.error) {
        console.error('Error applying changes:', response.error);
        // Handle error case
      } else {
        console.log('Changes applied successfully:', response.output);
        alert('change applied successfully');
        // Handle success case
      }
    });
  });

  // Find the button container within the sticky div
  const buttonContainer = stickyDiv.firstChild || stickyDiv;
  
  // Insert at the beginning of the container
  buttonContainer.prepend(applyButton);

  // Mark as processed
  codeBlock.dataset.buttonAdded = 'true';
}

// Rest of the code remains the same
function addButtonsToCodeBlocks() {
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock) => {
    if (!codeBlock.dataset.buttonAdded) {
      addCodeBlockButton(codeBlock);
    }
  });
}

const codeBlockObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('pre code')) {
            addCodeBlockButton(node);
          }
          const codeBlocks = node.querySelectorAll('pre code');
          codeBlocks.forEach(codeBlock => {
            if (!codeBlock.dataset.buttonAdded) {
              addCodeBlockButton(codeBlock);
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

