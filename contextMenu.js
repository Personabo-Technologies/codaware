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
  
// Add this function to handle all menu-related keyboard events
function handleMenuKeyboardEvents(event, inputField) {
  const menu = document.getElementById('mention-context-menu');
  
  // Handle keydown events when menu is open
  if (event.type === 'keydown' && menu) {
    if (event.key === 'Enter') {
      console.log("captured enter inside mention menu");
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      const menuItems = document.querySelectorAll('.mention-menu-item');
      if (menuItems.length > 0 && currentMenuIndex >= 0) {
        const selectedItem = menuItems[currentMenuIndex];
        const suggestionLabel = selectedItem.innerText;
        
        getSuggestions('').then(suggestions => {
          const suggestion = suggestions.find(s => s.label === suggestionLabel);
          if (selectedItem && suggestion) {
            insertMentionContent(inputField, suggestion);
            removeContextMenu();
          }
        });
      }
      return false;
    }
  }

  // Handle keyup events
  if (event.type === 'keyup') {
    // Check if menu is open first for navigation
    if (menu && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      console.log(`Navigating menu with key: ${event.key}`);
      event.preventDefault();
      event.stopPropagation();
      navigateMenu(event.key);
      return;
    }

    if (event.key === ">") {
      // Get the current selection
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const currentNode = range.startContainer;
      
      // Check for context menu trigger
      const textContent = currentNode.textContent;
      const cursorPosition = range.startOffset;
      const textBeforeCursor = textContent.slice(0, cursorPosition);
      
      const lastIndex = textBeforeCursor.lastIndexOf('>');
      const shouldShowFileSuggestions = shouldShowContextMenu(textBeforeCursor, lastIndex);
      
      if (lastIndex !== -1 && shouldShowFileSuggestions) {
        const query = textBeforeCursor.slice(lastIndex + 1);
        showContextMenu(inputField, range, query.trim());
      } else {
        removeContextMenu();
      }
    }
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
            insertMentionContent(document.querySelector(getSelectors().inputField), suggestion);
            //removeContextMenu();
          }
        });
      }
    } else if (event.key === 'Escape') {
      console.log("Captured Escape inside FileMenu")
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