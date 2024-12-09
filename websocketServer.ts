/**
 * This is the code running on VS Code side
 * It opens up a websocket and serves the file content.
 * The apply change function uses a proprietary model, code is not shared.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { applyDiff } from "../diff/applyChanges";

const WebSocket = require('ws');
const defaultPort = 49201;

export class WebSocketServer {
  private wss: any;
  private staticIgnoredExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".exe", ".dll",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z", ".lock", ".env", ".testresult",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"
  ];

  constructor(context: vscode.ExtensionContext) {
    this.wss = new WebSocket.Server({ port: defaultPort });
    this.initializeWebSocket(context);
  }

  // Updated getWorkspaceFiles to exclude:
  // 1. Files/folders matched by .gitignore patterns.
  // 2. Any folder that starts with '.' (e.g., .git, .vscode, etc.).
  private async getWorkspaceFiles() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    let ignorePatterns: string[] = [];

    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
      const lines = gitignoreContent.split('\n').map(line => line.trim());
      ignorePatterns = lines.filter(line => line && !line.startsWith('#'));
    }

    const allFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    const relativePaths = allFiles.map(file => vscode.workspace.asRelativePath(file));

    // Filter out files that should be ignored:
    // 1. Exclude files in any directory that starts with '.'.
    // 2. Exclude files based on .gitignore patterns (very naive approach).
    const filteredPaths = relativePaths.filter(filePath => {
      // Check for '.' prefixed directories
      const pathSegments = filePath.split(/[\\/]/); // split on both backslash and forward slash
      if (pathSegments.some(segment => segment.startsWith('.') && segment.length > 1)) {
        // Comment: If any directory segment starts with '.', exclude this file
        return false;
      }

      const ext = path.extname(filePath).toLowerCase();
      if (this.staticIgnoredExtensions.includes(ext)) {
        return false;
      }

      // Check ignore patterns
      for (const pattern of ignorePatterns) {
        if (this.fileShouldBeIgnored(filePath, pattern)) {
          return false;
        }
      }

      return true;
    });

    return filteredPaths;
  }

  private fileShouldBeIgnored(filePath: string, pattern: string): boolean {
    // A very naive approach to pattern checking:
    // - If pattern ends with '/', treat it as a directory pattern and check if filePath starts with that directory.
    // - If pattern starts with '/', match from the start of the filePath.
    // - Otherwise, check if filePath includes the pattern as a substring.

    if (pattern.endsWith('/')) {
      const dir = pattern.slice(0, -1);
      if (!dir) return false;
      return filePath === dir || filePath.startsWith(dir + '/');
    }

    if (pattern.startsWith('/')) {
      const trimmedPattern = pattern.slice(1);
      return filePath === trimmedPattern || filePath.startsWith(trimmedPattern + '/');
    }

    return filePath.includes(pattern);
  }

  private async initializeWebSocket(context: vscode.ExtensionContext) {
    this.wss.on('connection', async (ws: any) => {
      console.log('Chrome extension connected');
      
      ws.on('message', async (message: string) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'REQUEST_FILES':
            const files = await this.getWorkspaceFiles();
            ws.send(JSON.stringify({
              type: 'FILE_LIST',
              files
            }));
            break;

          case 'GET_FILE_CONTENTS':
            await this.handleGetFileContents(ws, data);
            break;

          case 'DIFF_CLIPBOARD':
            await this.handleDiffClipboard(ws, data);
            break;
        }
      });

      // Watch for file changes
      this.setupFileWatcher(ws, context);
    });

    const message = vscode.window.showInformationMessage(`EasyCode running on port ${defaultPort}`);
    setTimeout(() => {
        message.then(() => {
            // dismiss the notification
        });
    }, 1000);
  }

  private async handleGetFileContents(ws: any, data: any) {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          error: 'No workspace folder open'
        }));
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const fullPath = path.join(workspaceRoot, data.filePath.trim());
      
      const filePath = data.filePath.startsWith('/') 
        ? data.filePath.slice(1) 
        : data.filePath;
        
      const content = await fs.promises.readFile(fullPath, 'utf8');
      ws.send(JSON.stringify({
        type: 'FILE_CONTENTS',
        filePath: data.filePath,
        content
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: `Failed to read file: ${(error as Error).message}`
      }));
    }
  }

  private async handleDiffClipboard(ws: any, data: any) {
    try {
      const { fileName, code } = data; // Add code to destructuring
      console.log(`received request to apply to ${fileName} \n ${code}`);
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('No workspace folder open');
      }

      await applyDiff({
        codeToApply: [code],
        filePath: fileName,
        onFinish: () => {
          console.log("apply finished");
          ws.send(JSON.stringify({
            type: 'DIFF_CLIPBOARD_RESULT',
            fileName, 
            success: true
          }));
        },
        onError: () => {
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: `Failed to handle clipboard diff`
          }))
        }
      });

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: `Failed to handle clipboard diff: ${(error as Error).message}`
      }));
    }
  }

  private setupFileWatcher(ws: any, context: vscode.ExtensionContext) {

    const firstWorkspace = vscode.workspace.workspaceFolders?.[0];
    if (!firstWorkspace) {
      return null;
    }

    const fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
      firstWorkspace,
      `**/${path.join(".vscode", "easycode.ignore")}`
    ));
    
    const updateFiles = async () => {
      const files = await this.getWorkspaceFiles();
      ws.send(JSON.stringify({
        type: 'FILE_LIST',
        files
      }));
    };

    fileWatcher.onDidCreate(updateFiles);
    fileWatcher.onDidDelete(updateFiles);

    context.subscriptions.push(fileWatcher);
  }

  public dispose() {
    this.wss.close();
  }
}
