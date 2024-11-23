// content.js

async function initializeMentionExtension(inputField) {
  inputField.classList.add('mention-extension-enabled');

  // Keep the mention-specific keydown handler
    inputField.addEventListener('keydown', async (event) => {
      console.log("inputField captured keydown")
    const menu = document.getElementById('mention-context-menu');
    if (menu) {
      console.log("Mention menu active - handling keydown");
      
      if (event.key === 'Enter') {
        console.log("captured enter inside mention menu");
        event.preventDefault();
        event.stopPropagation();
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
            await insertMentionContent(inputField, suggestion);
            removeContextMenu();
          }
        }
        return false;
      }
    }
  }, { capture: true, passive: false });

  inputField.addEventListener('keyup', handleKeyUp, true);

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

// Wrap the observer initialization in a function
function initializeObservers() {
  // Main observer for input field
  const observer = new MutationObserver(() => {
    const selectors = getSelectors();
    if (!selectors) return;

    const inputField = document.querySelector(selectors.inputField);
    if (inputField && !inputField.classList.contains('mention-extension-enabled')) {
      initializeMentionExtension(inputField);
    }
  });

  // Code block observer
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

  // Function to start observers
  function startObservers() {
    if (document.body) {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      codeBlockObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // Check document readiness and initialize accordingly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObservers);
  } else {
    startObservers();
  }

  // Backup timeout in case DOMContentLoaded already fired
  setTimeout(startObservers, 1000);
}

// Initialize everything
initializeObservers();

// Initialize code block buttons with proper timing
function initializeCodeBlockButtons() {
  addButtonsToCodeBlocks();
  //setTimeout(addButtonsToCodeBlocks, 1000);
  //setInterval(addButtonsToCodeBlocks, 2000);
}

// Start the code block button initialization
if (document.readyState === 'loading') {
  console.log("page still loading, wait for DOM load");
  document.addEventListener('DOMContentLoaded', initializeCodeBlockButtons);
} else {
  console.log("page loaded, attempting to add buttons");
  initializeCodeBlockButtons();
}

// Insert mention content
async function insertMentionContent(inputField, suggestion) {
  const container = createChipsContainer(inputField);
  
  // Create and add chip immediately
  const chip = createFileChip(suggestion);
  container.appendChild(chip);

  if (!(suggestion.label in fileContentCache) && suggestion.type !== 'folder') {
    getFileContents(suggestion.label.slice(1))
      .then(content => {
        fileContentCache[suggestion.label] = content;
      })
      .catch(error => {
        console.error('Error caching file content:', error);
      });
  }

  // Clean up '>' character and add file name
  const currentText = inputField.value || inputField.innerText;
  if (currentText.endsWith('>')) {
    const newText = currentText.slice(0, -1) + `file: ${suggestion.label.slice(1)} `; // slice(1) removes the leading '/'
    if (inputField.value !== undefined) {
      inputField.value = newText;
    } else {
      inputField.innerText = newText;
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
