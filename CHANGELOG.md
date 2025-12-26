### Changelog

#### 2025-11-22

- UI: Made the clear-history buttons in the configuration panel compact and
  inline with labels.
  - Added a small icon button style (`.icon-btn--sm`) and laid out fields as a
    3‑column grid (Label | Clear | Control).
  - Ensures better readability and spacing in both Light and Dark themes while
    keeping buttons accessible.
- Documentation: Polished README.
  - Documented strict offline asset loading (no CDN fallback), offline
    checklist, and troubleshooting.
  - Added keyboard shortcut notes (Ctrl/Cmd+Shift+C), synchronized time axis
    mention, and clear‑history tips.
- Offline assets: Vendoring and server fixes (from prior passes) are now stable.
  - Local Tabler webfont assets are referenced from `web/vendor/...` paths only.
  - Server serves correct MIME types and avoids SPA fallback for asset requests.

#### 2025-11-21

- Server: Exported `appHandler` and refined routing.
- Tests: Added coverage for content types, SPA vs 404, and traversal protection.
- Vendoring: Robust Tabler webfont vendoring script and verification task.
- UI/UX: Global config toggle button, keyboard shortcut, synchronized time axis,
  spinner during file load, persistent tab titles, and improved Light/Dark theme
  contrast.
