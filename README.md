# Morph Web Extension

A Chrome extension that lets users manage cookies, hide webpage content, and change proxy settings.  
- **Cookie Editor:** View, add, and modify cookies for the current website.  
- **XSS Manager:** Keeps track of URLs where Blind XSS payloads were injected.
- **Proxy Manager:** Change proxy settings directly from the extension. 

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