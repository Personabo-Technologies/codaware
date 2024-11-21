// Add a cache object to store file contents
const fileContentCache = {};

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

  
