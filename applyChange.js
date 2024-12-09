const SPINNER_SVG = `<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>`;

const TIMEOUT_DURATION = 120000; // 2 minutes in milliseconds

// Function to add button to code blocks
function addCodeBlockButton(codeBlock) {
    console.log(codeBlock);

    // Check if button was already added using dataset
    if (codeBlock.dataset.buttonAdded) {
        console.log("skipping adding button, already has it");
        return; // Add early return here
    }

    const platform = getCurrentPlatform();
    if (!platform) return;
    const selectors = platform.selectors;

    // For both ChatGPT and Claude
    if (codeBlock.matches(selectors.codeBlock)) {
        const containerDiv = codeBlock.closest(selectors.codeActionButtonContainer);
        if (!containerDiv) return;
        
        let buttonContainer = containerDiv.querySelector(`${platform.buttonStyle.container}`);
        
        // Check if button already exists in the container
        if (buttonContainer) {
            const existingApplyButton = Array.from(buttonContainer.querySelectorAll('button')).find(
                btn => btn.innerHTML === platform.buttonStyle.icon
            );
            if (existingApplyButton) {
                console.log("Apply button already exists, remove the current one");
                codeBlock.dataset.buttonAdded = 'true';
                buttonContainer.removeChild(existingApplyButton);
            }
        } else {
            buttonContainer = document.createElement('div');
            buttonContainer.className = platform.buttonStyle.container;
            codeBlock.appendChild(buttonContainer);
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
    }

    codeBlock.dataset.buttonAdded = 'true';
    console.log("adding button for codeblock");
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

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

          // Check WebSocket connection
        const isConnected = await isWebSocketConnected();

        if (!isConnected) { 
          alert("Cannot connect with VS Code, please ensure EasyCode extension is installed");
          return true;
        } 
        
        const platform = getCurrentPlatform();
        const selectors = platform.selectors;

        let code;
        if (window.location.hostname.includes('claude.ai')) {
            const containerDiv = button.closest(selectors.codeActionButtonContainer);
            codeblock = containerDiv.querySelector(selectors.codeBlock);
            code = codeBlock.querySelector('code').textContent
        } else {
            code = codeBlock.matches(selectors.codeBlock) && codeBlock.querySelector('code') 
            ? codeBlock.querySelector('code').textContent 
            : codeBlock.textContent;
        }
        
        console.log('Code block content:', code);
    
        try {
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
        } catch (e) {
            alert("Failed to apply change, please ensure VS Code extension is running and the right project is open");
        }
    });
  }


// Rest of the code remains the same
function addButtonsToCodeBlocks() {
    const platform = getCurrentPlatform();
    if (!platform) return;
  
    const codeBlocks = document.querySelectorAll(platform.selectors.codeBlock);
    codeBlocks.forEach((codeBlock) => {
        addCodeBlockButton(codeBlock, platform);
    });
  }