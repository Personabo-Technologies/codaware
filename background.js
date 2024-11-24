// background.js

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second between retries

function safeStorageAccess(operation) {
  // Check if chrome.storage is available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return operation();
  } else {
    console.warn('Chrome storage API not available');
    // Optionally retry after a short delay
    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        operation();
      }
    }, 1000);
  }
}

// Helper function to safely send WebSocket messages
function safeSendWebSocketMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  console.warn('WebSocket not ready, message not sent:', message);
  return false;
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('ChatGPT Mention Extension installed.');
});

let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

function connectWebSocket() {
  socket = new WebSocket('ws://localhost:8080');
  
  socket.onopen = () => {
    console.log('Connected to VS Code extension');
    reconnectAttempts = 0; // Reset attempts on successful connection
    
    // Add a small delay to ensure the connection is ready
    setTimeout(() => {
      safeSendWebSocketMessage({
          type: 'REQUEST_FILES'
      });
    }, 100);
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'FILE_LIST') {
      console.log(`received file list`);
      safeStorageAccess(() => {
        chrome.storage.local.set({
          filePaths: data.files
        });
      });
    } else if (data.type === 'FILE_CONTENTS') {
      console.log("Looking for file content callback for:", data.filePath);
      if (fileContentCallbacks[data.filePath]) {
        fileContentCallbacks[data.filePath]({
          content: data.content
        });
        delete fileContentCallbacks[data.filePath];
      } else {
        console.warn("No file content callback found for:", data.filePath);
      }
    } else if (data.type === 'DIFF_CLIPBOARD_RESULT') { // Assuming this is the type for diff responses
      console.log("Looking for diff callback for:", data.fileName);
      if (diffCallbacks[data.fileName]) {
        diffCallbacks[data.fileName](data);
        delete diffCallbacks[data.fileName];
      } else {
        console.warn("No diff callback found for:", data.fileName);
      }
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket closed');
    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(connectWebSocket, RECONNECT_DELAY);
    } else {
      console.error('Max reconnection attempts reached');
    }
  };
}

// Add a function to check connection status
function isSocketConnected() {
  return socket && socket.readyState === WebSocket.OPEN;
}

connectWebSocket();

// Separate callback queues
let fileContentCallbacks = {};
let diffCallbacks = {};

// Add a helper function to handle retries
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (isSocketConnected()) {
      return await operation();
    }
    
    console.log(`WebSocket not connected, attempt ${attempt + 1}/${maxRetries}`);
    
    // Try to reconnect
    connectWebSocket();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  
  throw new Error('WebSocket connection failed after retries');
}

// Modify the message listener to use retries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'APPLY_DIFF') {
    console.log("Background: received request to apply diff for:", message.fileName);
    
    retryOperation(async () => {
      // Store in diff-specific callback queue
      diffCallbacks[message.fileName] = (response) => {
        console.log("Diff result received:", response);
        sendResponse(response);
      };
      
      if (!safeSendWebSocketMessage({
        type: 'DIFF_CLIPBOARD',
        fileName: message.fileName,
        code: message.code
      })) {
        throw new Error('Failed to send diff request');
      }
    })
    .catch(error => {
      console.error('Error applying diff:', error);
      sendResponse({ 
        error: 'Failed to apply changes after retries. Please check your connection.' 
      });
    });

    return true;
  }
  else if (message.type === 'GET_FILE_CONTENTS') {
    console.log("Background: received request for file:", message.filePath);
    
    retryOperation(async () => {
      // Store in file-specific callback queue  
      fileContentCallbacks[message.filePath] = (response) => {
        console.log("Executing callback for:", message.filePath, response);
        sendResponse(response);
      };

      if (!safeSendWebSocketMessage({
        type: 'GET_FILE_CONTENTS',
        filePath: message.filePath.trim()
      })) {
        throw new Error('Failed to send file contents request');
      }
    })
    .catch(error => {
      console.error('Error getting file contents:', error);
      sendResponse({ 
        error: 'Failed to get file contents after retries. Please check your connection.' 
      });
    });

    return true;
  }
});