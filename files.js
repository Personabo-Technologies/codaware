// Add a cache object to store file contents
const fileContentCache = {};

// Function to extract file paths from the page content
function extractFilePaths() {
  const filePathRegex = /filepath:(\/[^\s]+)/g;
  const textNodes = document.evaluate(
    "//text()", 
    document.body,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  const paths = new Set();
  
  for (let i = 0; i < textNodes.snapshotLength; i++) {
    const text = textNodes.snapshotItem(i).textContent;
    const matches = text.matchAll(filePathRegex);
    for (const match of matches) {
      paths.add(match[1]); // match[1] contains the path without the "filepath:" prefix
    }
  }

  return Array.from(paths);
}

// Function to populate the cache
async function populateFileCache() {
  const paths = extractFilePaths();
  console.log('Found file paths to cache:', paths);

  for (const path of paths) {
    try {
      if (!fileContentCache[path]) {
        console.log('Fetching content for:', path);
        const content = await getFileContents(path);
        fileContentCache[path] = content;
      }
    } catch (error) {
      console.error(`Failed to cache content for ${path}:`, error);
    }
  }
}

// Modified getFileContents with retry logic
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

// Add URL tracking variable
let currentPath = window.location.pathname;

// Modified initializeCache function
function initializeCache() {
  // Create function to set up observer
  function setupRouteObserver() {
    if (!document.body) {
      console.log('Body not ready, waiting...');
      setTimeout(setupRouteObserver, 100);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        console.log('SPA route changed, updating cache...', newPath);
        currentPath = newPath;
        populateFileCache();
      }
    });

    // Start observing once body is available
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('Route observer set up successfully');
  }

  // Set up route observer
  setupRouteObserver();

  // Also handle manual navigation events
  window.addEventListener('popstate', () => {
    const newPath = window.location.pathname;
    if (newPath !== currentPath) {
      console.log('Navigation occurred, updating cache...', newPath);
      currentPath = newPath;
      populateFileCache();
    }
  });

  // Original initialization code
  function startCachePopulation() {
    populateFileCache();
  }

  if (document.readyState === 'complete') {
    startCachePopulation();
  } else {
    window.addEventListener('load', startCachePopulation);
    setTimeout(() => {
      if (document.body) {
        startCachePopulation();
      }
    }, 1000);
  }
}

// Call initialization
initializeCache();

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
