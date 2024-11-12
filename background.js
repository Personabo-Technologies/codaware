// This script can handle events or perform tasks in the background
chrome.runtime.onInstalled.addListener(() => {
    console.log('ChatGPT Mention Extension installed.');
});

let socket;

function connectWebSocket() {
  socket = new WebSocket('ws://localhost:8080');
  
socket.onopen = () => {
    console.log('Connected to VS Code extension');
    socket.send(JSON.stringify({
      type: 'REQUEST_FILES'
    }));
  };
  
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'FILE_LIST') {
      console.log(data.files);
      chrome.storage.local.set({
        filePaths: data.files
      });
    } else if (data.type === 'FILE_CONTENTS') {
console.log("forwarding file content for:", data.filePath);
      
      // Store the callback function in a variable that can access the response
if (pendingCallbacks[data.filePath]) {
  console.log("Found callback for:", data.filePath, data.content);
  pendingCallbacks[data.filePath]({
    content: data.content
  });
  delete pendingCallbacks[data.filePath];
} else {
  console.warn("No callback found for:", data.filePath);
}
    }
};
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket closed');
  };
}

connectWebSocket();

let pendingCallbacks = {};

// Modify the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_FILE_CONTENTS') {
    console.log("Background: received request for file:", message.filePath);
    // Store callback with file path as key
pendingCallbacks[message.filePath] = (response) => {
  console.log("Executing callback for:", message.filePath, response);
  sendResponse(response);
};
    
    // Make sure socket is connected
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      sendResponse({ error: 'WebSocket not connected' });
      return false;
    }
    
    try {
      socket.send(JSON.stringify({
        type: 'GET_FILE_CONTENTS',
        filePath: message.filePath.trim()
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      sendResponse({ error: 'Failed to send message' });
      return false;
    }
    
    // Keep the message channel open for the async response
    return true;
  }
});