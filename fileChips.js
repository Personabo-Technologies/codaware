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
    removeBtn.onclick = () => {
      chip.remove();
    };
    chip.appendChild(removeBtn);
    
    return chip;
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
