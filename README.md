# Morph Web Extension

A simple Chrome extension built with Vite and TypeScript.
A Chrome extension that lets users manage cookies, hide webpage content, and change proxy settings.  
- **Cookie Editor:** View, add, and modify cookies for the current website.  
- **Proxy Manager:** Change proxy settings directly from the extension. 
- **Content Hider:** Hide elements on a page by specifying their tag name, class, or ID.  

## Setup

1. Install dependencies:
```bash
   npm install
```
2. Build the project:
```bash
npm run build
```
3. Load the dist folder in Chrome:

-   Go to chrome://extensions

-   Enable `Developer Mode`

-   Click `Load unpacked` and select the `dist/` directory