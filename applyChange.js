// Function to add button to code blocks
function addCodeBlockButton(codeBlock) {
    if (codeBlock.dataset.buttonAdded) return;
  
    const platform = getCurrentPlatform();
    if (!platform) return;
    const selectors = platform.selectors;
  
    // For both ChatGPT and Claude
    if (codeBlock.matches(selectors.codeBlock)) {
      const containerDiv = codeBlock.closest(selectors.codeActionButtonContainer);
      if (!containerDiv) return;
      
      let buttonContainer = containerDiv.querySelector(`${platform.buttonStyle.container}`);
      if (!buttonContainer) {
          buttonContainer = document.createElement('div');
          buttonContainer.className = platform.buttonStyle.container;
          codeBlock.appendChild(buttonContainer);
      } else {
      }
  
      const applyButton = document.createElement('button');
      if (platform === PLATFORMS.CHATGPT) {
        applyButton.style.cssText = platform.buttonStyle.button;
        buttonContainer.firstChild.prepend(applyButton);
      } else if (platform == PLATFORMS.CLAUDE) {
        applyButton.className = platform.buttonStyle.button;
        buttonContainer.prepend(applyButton);
      }
      applyButton.innerHTML = platform.buttonStyle.icon;
      
      setupButtonClickHandler(applyButton, codeBlock);
    } else {
    }
  
    codeBlock.dataset.buttonAdded = 'true';
}

// Helper function for button click handler
function setupButtonClickHandler(button, codeBlock) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const platform = getCurrentPlatform();
      const selectors = platform.selectors;

      // Extract code content using platform-specific selectors
      const code = codeBlock.matches(selectors.codeBlock) && codeBlock.querySelector('code') 
        ? codeBlock.querySelector('code').textContent 
        : codeBlock.textContent;
      
      console.log('Code block content:', code);
      
      const similarityScores = predictApplyDestination(code);
      const applyDestination = similarityScores.reduce((best, current) =>
        current.score > best.score ? current : best
      );
  
      // Format similarity scores for display
      const scoresText = similarityScores
        .sort((a, b) => b.score - a.score)
        .map(entry => `${entry.fileName}: ${(entry.score * 100).toFixed(1)}%`)
        .join('\n');
      
      // Show confirmation dialog
      const confirmMessage = `Do you want to apply changes to:\n${applyDestination.fileName}\n\nAll matches:\n${scoresText}`;
      
      if (confirm(confirmMessage)) {
        chrome.runtime.sendMessage({
          type: 'APPLY_DIFF',
          fileName: `.${applyDestination.fileName}`,
          code: code
        }, (response) => {
          if (response.error) {
            console.error('Error applying changes:', response.error);
            alert('Failed to apply changes: ' + response.error);
          } else {
            console.log('Changes applied successfully:', response.output);
            alert('Changes applied successfully');
          }
        });
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