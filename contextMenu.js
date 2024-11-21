let currentMenuIndex = 0; // Track the currently highlighted menu item

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
  
  function removeContextMenu() {
    const existingMenu = document.getElementById('mention-context-menu');
    if (existingMenu) {
      existingMenu.parentNode.removeChild(existingMenu);
      // Return focus to the original input field
      const inputField = getInputField();
      inputField.focus();
    }
  }