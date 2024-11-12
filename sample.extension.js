const WebSocket = require('ws');
const vscode = require('vscode');

function activate(context) {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', (ws) => {
    console.log('Chrome extension connected');
    
    ws.on('message', (message) => {
      console.log('Received from Chrome:', message);
      ws.send('Hello from VS Code!');
    });
  });

  vscode.window.showInformationMessage('WebSocket server started on port 8080');

  context.subscriptions.push({
    dispose: () => wss.close()
  });
}

module.exports = { activate };