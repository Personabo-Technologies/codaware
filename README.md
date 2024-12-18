<h1 align="center"><br>Codaware - by EasyCode<br></h1>
<p align="center">Chat with Codebase from ChatGPT Web or Claude.ai</p>

## Benefits
- no more copying & pasting
- don't pay for multiple subscriptions, use chatgpt plus or claude paid plan, and advanced models
- take advantage of web features such as o1-preview, image, web search, artifacts, etc.
- protect your code, only share whats necessary

## Features
- [x] reference files on ChatGPT & Claude.ai
- [x] ability to apply changes directly from ChatGPT 
    - [ ] send user query to aider as well when applying changes
- [x] ability to apply changes directly from Claude -> DO THIS NEXT [Easy]
- [x] populate filecache for previous chats.
- [ ] add ability to drag a folder and parse the file path, and fetch the files.. [Medium]
- [ ] send file updates from vscode to browser.
- [ ] compare answer with different models such as DeepSeek, Qwen, Llama 3, etc. [Hard]
- [ ] add ability to watch for errors in console, auto suggest it in the web browser [Medium?]

## Bugs
- [x] hitting ENTER sends question without injecting file content [Medium]
- [x] Error loading files sometimes
- [x] socket error sometimes [Tiny]
- [x] prevent duplicated files from being added.  [Tiny]

## Improvements
- [x] refactor front end into more modular components [Medium]
  - [ ] migrate project to react or nextjs [Medium]
  - [ ] add bundling 
- [ ] add a file name place holder after the file is injected [tiny]
- [x] refactor vscode side to its own folder and make it modular as well, 
- [x] stop generation doesn't work due to capturing the button submit [Medium?]
- [ ] collapse the codeblocks in the "sent" sections [Tiny/Easy]
- [ ] don't resend file content its already in chat context [Tiny]

## Future Feature Ideas
- have to copy and paste error from service worker in background.js
- ability to @problems inside chrome extension
- ability to @codebase 

## Bugs or Features
- Please submit a issue. 