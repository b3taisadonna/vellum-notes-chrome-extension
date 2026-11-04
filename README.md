# Vellum Notes

Vellum is a quiet Markdown notes desk that saves notes locally in the browser.
This repository also contains a standalone Chrome Manifest V3 extension.

## Chrome extension download

[Download Vellum Notes for Chrome](https://github.com/b3taisadonna/vellum-notes-chrome-extension/releases/latest/download/vellum-notes-chrome.zip)

To install manually, open `chrome://extensions`, enable Developer mode, choose
“Load unpacked”, and select the `extension/` folder (or the generated
`dist/chrome-extension/` folder).

## Build the extension

```bash
npm install
npm run extension:build
```

The Web Store package is created at `dist/vellum-notes-chrome.zip`.

The extension needs no permissions and stores notes only in the local browser
storage. It does not transmit note content to a server.
