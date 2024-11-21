// content.js

const PLATFORMS = {
  CHATGPT: {
    hostnames: ['chat.openai.com', 'chatgpt.com'],
    selectors: {
      inputField: '#prompt-textarea',
      sendButton: '[data-testid="send-button"]',
      editor: '.ProseMirror',
      codeBlock: 'pre code',
      codeBlockContainer: '.sticky'
    },
    inputFieldType: 'textarea',
    buttonStyle: {
      container: 'sticky',
      button: `
        padding: 4px 8px;
        background: #2A2B32;
        border: 1px solid #565869;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 12px;
        margin-right: 8px;
      `,
      icon: '📋 Apply Change'
    }
  },
  CLAUDE: {
    hostnames: ['claude.ai'],
    selectors: {
      inputField: '[contenteditable="true"].ProseMirror',
      sendButton: 'button[aria-label="Send Message"]',
      editor: '.ProseMirror',
      codeBlock: '.code-block__code',
      codeBlockContainer: '.flex.flex-1.items-center.justify-end'
    },
    inputFieldType: 'contenteditable',
    buttonStyle: {
      container: 'flex flex-1 items-center justify-end',
      button: `inline-flex items-center justify-center relative shrink-0 ring-offset-2 
        ring-offset-bg-300 ring-accent-main-100 focus-visible:outline-none 
        focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 
        disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] 
        from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 
        font-medium font-styrene text-text-100/90 transition-colors 
        active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 
        h-8 rounded-md px-3 text-xs min-w-[4rem] active:scale-[0.985] whitespace-nowrap`,
      icon: 'Apply'
    }
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

function getSuggestions(query, retryCount = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    const tryGetSuggestions = (attemptNumber) => {
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (attemptNumber < retryCount) {
          console.log(`Chrome storage not available, retrying in ${delay}ms (attempt ${attemptNumber + 1}/${retryCount})`);
          setTimeout(() => tryGetSuggestions(attemptNumber + 1), delay);
          return;
        }
        reject(new Error('Chrome storage API not available'));
        return;
      }

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
    };

    tryGetSuggestions(0);
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
  //console.log(`handleKeyUp called. Key: ${event.key}`);
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
    //console.log("should show context menu")
    const query = textBeforeCursor.slice(lastIndex + 1);
    //console.log(`Triggering context menu with query: ${query.trim()}`);
    showContextMenu(inputField, range, query.trim());
  } else {
    // console.log('No context menu trigger found. Removing context menu.');
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
  try {
    menu.innerHTML = '';
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
  } catch (error) {
    console.error('Error getting suggestions:', error);
    const errorItem = document.createElement('div');
    errorItem.className = 'mention-menu-item error';
    errorItem.innerText = 'Error loading suggestions';
    menu.appendChild(errorItem);
  }
}

function getInputField() {
  const selectors = getSelectors();
  return document.querySelector(selectors.inputField);
}

// Add a cache object to store file contents
const fileContentCache = {};

// Modify insertMentionContent to fetch and cache content immediately
async function insertMentionContent(suggestion) {
  const inputField = getInputField();
  const container = createChipsContainer(inputField);
  
  // CHANGE: Create and add chip immediately
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

// Modify processFileChips to use cached content
async function processFileChips(fileChips) {
  return Promise.all(
    Array.from(fileChips).map(async chip => {
      const label = chip.textContent.split('×')[0].trim().slice(2).trim();

      try {
        // CHANGE: Use object notation to access cached content
        let content = fileContentCache[label];
        if (!content) {
          content = await getFileContents(label);
          fileContentCache[label] = content; // Store using object notation
          console.log("Initial file retrieval");
        } else {
          console.log("Cached file retrieval");
        }
        return `File: ${label}\n\`\`\`\n${content}\n\`\`\`\n`;
      } catch (error) {
        console.error('Error getting content for', label, error);
        return `File: ${label}\n\`\`\`\nError loading file content\n\`\`\`\n`;
      }
    })
  );
}

// Clear cache when chip is removed
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
  removeBtn.onclick = () => {
    chip.remove();
  };
  chip.appendChild(removeBtn);
  
  return chip;
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
// async function processFileChips(fileChips) {
//   console.log('Processing file chips:', fileChips.length);
//   return Promise.all(
//     Array.from(fileChips).map(async chip => {
//       const label = chip.textContent.split('×')[0].trim().slice(2).trim();
//       console.log('Requesting content for:', label);
//       try {
//         const content = await getFileContents(label);
//         console.log('Received content for:', label);
//         return `File: ${label}\n\`\`\`\n${content}\n\`\`\`\n`;
//       } catch (error) {
//         console.error('Error getting content for', label, error);
//         return `File: ${label}\n\`\`\`\nError loading file content\n\`\`\`\n`;
//       }
//     })
//   );
// }

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

// Clear cache when chip is removed
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

function predictApplyDestination(code, filesList) {
  if (!code) {
    return "ERROR: NO CODE PROVIDED";
  }
  if (!filesList) {
    filesList = fileContentCache;
  }
  if (Object.keys(filesList).length === 0) {
    return "ERROR: NO FILES AVAILABLE FOR MATCHING";
  }

  try {
    // Use findBestMatch to predict the destination
    const bestMatch = findBestMatch(code, filesList);
    console.log('Best matching file:', bestMatch);
    return bestMatch;
  } catch (error) {
    console.error('Error in predictApplyDestination:', error);
    return "ERROR: MATCHING FAILED";
  }

  //return `client/src/shared/utils/toast.js`;
}

// Function to add button to code blocks
function addCodeBlockButton(codeBlock) {
  if (codeBlock.dataset.buttonAdded) return;

  const platform = getCurrentPlatform();
  if (!platform) return;

  // For ChatGPT
  if (codeBlock.matches('pre code')) {
    const stickyDiv = codeBlock.closest('pre').querySelector('.sticky');
    if (!stickyDiv) return;
    
    const applyButton = document.createElement('button');
    applyButton.innerHTML = platform.buttonStyle.icon;
    applyButton.style.cssText = platform.buttonStyle.button;
    
    const buttonContainer = stickyDiv.firstChild || stickyDiv;
    buttonContainer.prepend(applyButton);
    
    setupButtonClickHandler(applyButton, codeBlock);
  }
  // For Claude
  else if (codeBlock.matches('.code-block__code')) {
    const containerDiv = codeBlock.closest('div[class="bg-bg-000 flex h-full flex-col"]');
    if (!containerDiv) return;
    
    let buttonContainer = containerDiv.querySelector('.flex.flex-1.items-center.justify-end');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = platform.buttonStyle.container;
        codeBlock.appendChild(buttonContainer);
    }

    const applyButton = document.createElement('button');
    applyButton.className = platform.buttonStyle.button;
    applyButton.innerHTML = platform.buttonStyle.icon;
    
    buttonContainer.insertBefore(applyButton, buttonContainer.firstChild);
    setupButtonClickHandler(applyButton, codeBlock);
  }

  codeBlock.dataset.buttonAdded = 'true';
}

// Helper function for button click handler
function setupButtonClickHandler(button, codeBlock) {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    let code;
    if (codeBlock.matches('.code-block__code')) {
      code = codeBlock.querySelector('code').textContent;
    } else {
      code = codeBlock.textContent;
    }
    
    console.log('Code block content:', code);
    
    const similarityScores = predictApplyDestination(code);
    const applyDestination = similarityScores.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // Format similarity scores for display
    const scoresText = similarityScores
      .sort((a, b) => b.score - a.score) // Sort descending
      .map(entry => `${entry.fileName}: ${(entry.score * 100).toFixed(1)}%`)
      .join('\n');
    
    // Show confirmation dialog
    const confirmMessage = `Do you want to apply changes to:\n${applyDestination.fileName}\n\nAll matches:\n${scoresText}`;
    
    if (confirm(confirmMessage)) {
            //Send message to background script with both filename and code
      chrome.runtime.sendMessage({
        type: 'APPLY_DIFF',
        fileName: `.${applyDestination.fileName}`,
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
    } else {
        console.log('NAY');
    }

  });
}

// Rest of the code remains the same
function addButtonsToCodeBlocks() {
  const platform = getCurrentPlatform();
  if (!platform) return;

  const codeBlocks = document.querySelectorAll(platform.selectors.codeBlock);
  codeBlocks.forEach((codeBlock) => {
    if (!codeBlock.dataset.buttonAdded) {
      addCodeBlockButton(codeBlock, platform);
    }
  });
}

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
