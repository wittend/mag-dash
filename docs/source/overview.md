# Overview

`mag-dash` is a lightweight dashboard to visualize ground magnetometer data in near‑real‑time or from local files. It is served by a small Deno HTTP server and rendered in your browser.

## Features

- Tabs: create one data source per tab; a fresh tab is automatically added once a tab is first used
- Sources: WebSocket URL (streaming JSON Lines), Local file (JSONL, with optional header skip), and a Local Device UI option (enter a device path; direct access requires Web Serial or a Deno proxy in a future step)
- Visualization: three canvas sparklines for X, Y, Z (nT) plus a scrollable history table (most recent first)
- Theme: light/dark toggle (persists)
- Export: download current tab data as JSONL
- Config: a configuration tab pinned at the far right for global preferences; inputs are readable, capped to ≤50% width, and never overflow the card
- Splitter: per‑tab left/right splitter position persists across reloads

## Run locally

Install Deno (2.x), then in the repository root:

```
deno task dev
```

Open `http://localhost:8000` in your browser.
