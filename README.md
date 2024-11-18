# Codaware
Chat with Codebase from ChatGPT Web or Claude.ai

## Benefits
- no more copying & pasting
- don't pay for multiple subscriptions, use chatgpt plus or claude paid plan, and advanced models
- take advantage of web features such as o1-preview, image, web search, artifacts, etc.
- protect your code, only share whats necessary

## Features
- [x] reference files on ChatGPT & Claude.ai
- [ ] add ability to drag a folder and parse the file path, and fetch the files.. [Medium]
- [x] ability to apply changes directly from ChatGPT 
    - [ ] send user query to aider as well when applying changes
- [ ] ability to apply changes directly from Claude -> DO THIS NEXT [Easy]
- [ ] compare answer with different models such as DeepSeek, Qwen, Llama 3, etc. [Hard]
- [ ] add ability to watch for errors in console, auto suggest it in the web browser [Medium?]

## Bugs
- [ ] hitting ENTER sends question without injecting file content [Medium]
- [x] Error loading files sometimes
- [ ] socket error sometimes [Tiny]
- [ ] prevent duplicated files from being added.  [Tiny]

## Improvements
- [ ] refactor front end into more modular components [Medium]
    - [ ] turn into react or nextjs [Medium]
    - [ ] add bundling 
- [x] refactor vscode side to its own folder and make it modular as well, 
- [ ] restore clipboard content when using aider apply [Tiny]
- [ ] stop generation doesn't work due to capturing the button submit [Medium?]
- [ ] collapse the codeblocks in the "sent" sections [Tiny/Easy]
- [ ] don't resend file content its already in chat context [Tiny]

## Future Feature Ideas
- have to copy and paste error from service worker in background.js
- ability to @problems inside chrome extension
- ability to @codebase 