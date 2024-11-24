const SPINNER_SVG = `<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>`;

const TIMEOUT_DURATION = 120000; // 2 minutes in milliseconds

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
    const originalButtonContent = button.innerHTML;
    let timeoutId = null;

    const resetButton = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        button.innerHTML = originalButtonContent;
        button.disabled = false;
    };

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const platform = getCurrentPlatform();
        const selectors = platform.selectors;

        const code = codeBlock.matches(selectors.codeBlock) && codeBlock.querySelector('code') 
            ? codeBlock.querySelector('code').textContent 
            : codeBlock.textContent;
        
        console.log('Code block content:', code);
        
        const similarityScores = predictApplyDestination(code);
        const applyDestination = similarityScores.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        const scoresText = similarityScores
            .sort((a, b) => b.score - a.score)
            .map(entry => `${entry.fileName}: ${(entry.score * 100).toFixed(1)}%`)
            .join('\n');
        
        const confirmMessage = `Do you want to apply changes to:\n${applyDestination.fileName}\n\nAll matches:\n${scoresText}`;
        
        if (confirm(confirmMessage)) {
            // Show spinner and disable button
            button.innerHTML = SPINNER_SVG;
            button.disabled = true;

            // Set timeout to reset button after 2 minutes
            timeoutId = setTimeout(() => {
                resetButton();
            }, TIMEOUT_DURATION);

            chrome.runtime.sendMessage({
                type: 'APPLY_DIFF',
                fileName: `.${applyDestination.fileName}`,
                code: code
            }, (response) => {
                if (response.error) {
                    console.error('Error applying changes:', response.error);
                    alert('Failed to apply changes: ' + response.error);
                    resetButton();
                } else {
                    console.log('Changes applied successfully:', response.output);
                    alert('Changes applied successfully');
                    resetButton();
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