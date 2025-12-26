<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Strict offline mode

When strict offline mode is enabled, `mag-dash` must not fetch any assets from
the public internet. This hardens offline deployments and ensures predictable
behavior in disconnected environments.

## What it affects

- MQTT client loading: the UI first attempts to load the vendored bundle at
  `web/vendor/mqtt/mqtt.bundle.mjs`.
- If strict offline is enabled and this local bundle is missing or unusable, the
  UI fails fast with a clear message and does not attempt any CDN fallback.

## How to enable

Use any one of the following (first match wins):

1. URL query: append `?strict_offline=1` to the page URL
2. Local storage: run `localStorage.setItem('magdash.strict_offline','1')` in
   DevTools and reload
3. Global flag: set `window.MAGDASH_STRICT_OFFLINE = true` before the app loads

Disable by removing the flag or setting it to `0`/`false`.

## Verifying offline readiness

- Run `deno run -A scripts/verify_assets.ts` to confirm vendored assets exist
  (Tabler Icons and MQTT bundle).
- In DevTools → Network, ensure no requests go to third‑party CDNs while using
  the app (including when opening the MQTT tab).

## Optional CSP

For defense‑in‑depth, add this header at your proxy:

```
Content-Security-Policy: default-src 'self'; connect-src 'self' ws: wss:
```

This blocks third‑party scripts while still allowing `ws:`/`wss:` data feeds.
