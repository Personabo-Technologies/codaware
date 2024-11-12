// content.js
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
  console.log("key up"); 
  const inputField = event.target;

  // Get the current selection
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  currentCursorPosition = range.endOffset;

  // Check if the context menu is open first
  const menu = document.getElementById('mention-context-menu');
  if (menu && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    // Prevent default behavior immediately
    event.preventDefault();
    event.stopPropagation();
    navigateMenu(event.key);
    return;
  }

  const textContent = inputField.innerText;
  const textBeforeCursor = textContent.slice(0, currentCursorPosition);

  // Check if the last character is '>'
  const lastIndex = textBeforeCursor.lastIndexOf('>');
  if (lastIndex !== -1 && shouldShowContextMenu(textBeforeCursor, lastIndex)) {
    const query = textBeforeCursor.slice(lastIndex + 1);
    showContextMenu(inputField, range, query.trim());
  } else {
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

  // Position the menu above the input field
  const inputRect = inputField.getBoundingClientRect();
  const menuTop = inputRect.top - 20; // Adjust this value to position the menu closer to the input field
  const menuLeft = inputRect.left;

  // Set the menu position using CSS variable
  menu.style.setProperty('--menu-top', `${menuTop}px`);
  menu.style.left = `${menuLeft}px`;

  // Set the width of the menu to match the input field
  menu.style.width = `${inputRect.width}px`; // Set width to match input field
  // Set a fixed height for the menu
  menu.style.height = '150px'; // Fixed height
  menu.style.overflowY = 'auto'; // Allow scrolling if needed

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

  // Find the position of the last '>' symbol before the cursor
  const textContent = inputField.innerText;
  const textBeforeCursor = textContent.slice(0, currentCursorPosition); 
  const lastArrowIndex = textBeforeCursor.lastIndexOf('>');

  // Remove the existing query text 
  const startOffset = lastArrowIndex + 1;
  const endOffset = currentCursorPosition;

  // Create a new range to replace the text
  const newRange = document.createRange();
  newRange.setStart(range.startContainer, startOffset);
  newRange.setEnd(range.endContainer, endOffset);
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

  // Trigger an input event to ensure ChatGPT recognizes the change
  inputField.dispatchEvent(new Event('input', { bubbles: true }));
}

function removeContextMenu() {
  const existingMenu = document.getElementById('mention-context-menu');
  if (existingMenu) {
    existingMenu.parentNode.removeChild(existingMenu);
  }
}

// Initialize when the element is found
async function initializeMentionExtension(inputField) {
  inputField.classList.add('mention-extension-enabled');

// Find and observe the send button
const sendButtonObserver = new MutationObserver(async (mutations, observer) => {
  const sendButton = document.querySelector('[data-testid="send-button"]');
  if (sendButton && !sendButton.hasAttribute('data-mention-intercepted')) {
    sendButton.setAttribute('data-mention-intercepted', 'true');
    
    sendButton.addEventListener('click', async (event) => {
      if (event.isTrusted && sendButton.hasAttribute('data-mention-intercepted')) {
        console.log("intercepted submit clicked");
        event.preventDefault();
        event.stopPropagation();
  
        const container = document.getElementById('file-chips-container');
        const fileChips = container ? container.querySelectorAll('.file-chip') : [];
  
        if (fileChips.length > 0) {
          try {
            console.log('Processing file chips:', fileChips.length);
            // Get contents for all files
            const fileContents = await Promise.all(
              Array.from(fileChips).map(async chip => {
                const label = chip.textContent.split('×')[0].trim().slice(2).trim(); // Remove emoji and trim
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
  
            // Append file contents to the message
            const proseMirrorEditor = document.querySelector('.ProseMirror');
            const currentText = proseMirrorEditor.innerText;
            const newText = `${currentText}\n\nReferenced Files:\n${fileContents.join('\n')}`;
            
            // Update the ProseMirror editor content
            proseMirrorEditor.innerHTML = newText
            .split('\n')
            .map(line => `<p>${line}</p>`)
            .join('');
                        
            // Clean up the chips container
            if (container) {
              container.remove();
            }
  
              // Only after all content is processed, trigger the simulated click
              sendButton.removeAttribute('data-mention-intercepted');
              await new Promise(resolve => setTimeout(resolve, 0)); // Give time for state to update
              
              // Use native click() method to bypass event listeners
              sendButton.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true, 
                view: window
              }));
              
              // Re-add the interceptor
              sendButton.setAttribute('data-mention-intercepted', 'true');
  
          } catch (error) {
            console.error('Error fetching file contents:', error);
          }
        }
      } else {
        console.log("skipping intercept submit clicked")
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
        event.stopPropagation();
      } else if (event.key === 'Enter') {
        // Stop the event immediately
        event.preventDefault();
        event.stopPropagation();
        
        // If we have menu items
        const menuItems = document.querySelectorAll('.mention-menu-item');
        if (menuItems.length > 0 && currentMenuIndex >= 0) {
          // Get the currently highlighted item's suggestion data
          const selectedItem = menuItems[currentMenuIndex];
          const suggestionLabel = selectedItem.innerText;
          
          // Ensure getSuggestions returns an array and handle potential errors
          const suggestions = await getSuggestions('') || [];
          const suggestion = Array.isArray(suggestions) 
            ? suggestions.find(s => s.label === suggestionLabel)
            : null;
          
          console.log(selectedItem);
          console.log(suggestionLabel);
          if (selectedItem) {
            insertMentionContent(inputField, suggestion);
            removeContextMenu();
          }
        }
      }
    }
  }, true); // Add capture phase

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
  const inputField = document.querySelector('#prompt-textarea');

  if (inputField && !inputField.classList.contains('mention-extension-enabled')) {
    initializeMentionExtension(inputField);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
