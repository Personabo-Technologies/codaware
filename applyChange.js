
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
  