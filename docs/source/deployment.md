<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Deployment

This page outlines local/offline and internet‑facing deployments, including constraints around browsers, TLS, and WebSocket/MQTT policies.

## Local / offline

- Start the bundled Deno server:

  ```
  deno task dev
  ```

- Visit `http://localhost:8000`.
- Ensure vendored assets exist:
  - Tabler Icons under `web/vendor/tabler/icons-webfont/3.35.0/`
  - MQTT bundle: `web/vendor/mqtt/mqtt.bundle.mjs`
- Optionally enable strict offline mode (see the dedicated page) to prevent any CDN access.
- Data sources must be reachable without the public internet, e.g.:
  - File mode (JSONL)
  - `ws://localhost:9000` or LAN WebSocket endpoints
  - `ws://` MQTT broker on localhost/LAN with WebSocket enabled

## Internet‑facing

- Serve the site with TLS (HTTPS) if you need to connect to secure feeds.
  - When the page is `https://`, the browser will block mixed content; use `wss://` for WebSockets (and MQTT over WebSocket).
- Configure your WebSocket servers and MQTT brokers to allow your dashboard’s Origin.
- Consider putting the Deno app behind a reverse proxy (nginx, Caddy, Traefik) to:
  - Terminate TLS
  - Add a Content‑Security‑Policy header (see below)
  - Add authentication and rate‑limiting if the site shouldn’t be public

### Suggested CSP (offline‑friendly)

```
Content-Security-Policy: default-src 'self'; connect-src 'self' ws: wss:
```

This blocks third‑party scripts and only allows network connections to your own origin plus `ws:`/`wss:` data feeds.

## Checklists

### Offline

- [ ] `/web/styles.css`, `/web/app.js`, and Tabler Icons assets load from local paths
- [ ] `web/vendor/mqtt/mqtt.bundle.mjs` exists and loads when using the MQTT tab
- [ ] DevTools → Network shows no requests to external CDNs (e.g., `https://esm.sh/`)
- [ ] Data sources are local (File or localhost/LAN WS/MQTT)

### Open internet

- [ ] Site is served via HTTPS (for `wss://` feeds)
- [ ] WS/MQTT servers allow the dashboard’s Origin
- [ ] Endpoints use `wss://` on HTTPS pages to avoid mixed content
- [ ] Optional CSP and proxy authentication are configured as needed
