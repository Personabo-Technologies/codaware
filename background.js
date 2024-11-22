// background.js

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

// Modify the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'APPLY_DIFF') {
    console.log("Background: received request to apply diff for:", message.fileName);
    
    if (!isSocketConnected()) {
      console.log('WebSocket not connected');
      sendResponse({ error: 'WebSocket not connected. Please try again.' });
      return false;
    }
    
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
      console.error('Failed to send diff request');
      sendResponse({ error: 'Failed to send diff request' });
      return false;
    }
    
    return true;
  }
  else if (message.type === 'GET_FILE_CONTENTS') {
    console.log("Background: received request for file:", message.filePath);
    
    // Store in file-specific callback queue
    fileContentCallbacks[message.filePath] = (response) => {
      console.log("Executing callback for:", message.filePath, response);
      sendResponse(response);
    };
    
    if (!isSocketConnected()) {
      console.log('WebSocket not connected, attempting to reconnect...');
      connectWebSocket(); // Try to reconnect
      sendResponse({ 
        error: 'WebSocket not connected. Please try again in a few seconds.' 
      });
      return false;
    }
    
    if (!safeSendWebSocketMessage({
        type: 'GET_FILE_CONTENTS',
        filePath: message.filePath.trim()
    })) {
      console.error('Failed to send file contents request');
      sendResponse({ error: 'Failed to send message' });
      return false;
    }
    
    // Keep the message channel open for the async response
    return true;
  }
});