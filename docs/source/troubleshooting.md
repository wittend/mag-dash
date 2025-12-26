<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Troubleshooting

## I see broken icons or missing glyphs

- Symptom: squares/tofu instead of icons; DevTools shows OTS errors for fonts.
- Fix:
  - Re‑vendor Tabler Icons: `deno task vendor:tabler`
  - Verify assets: `deno run -A scripts/verify_assets.ts`
  - Ensure the server serves correct MIME types for `.woff2/.woff/.ttf` (the
    bundled Deno server does).

## MQTT tab errors about strict offline mode

- Symptom: Error says strict offline is enabled and the local MQTT bundle is
  missing or unusable.
- Fix:
  - Ensure `web/vendor/mqtt/mqtt.bundle.mjs` exists and is non‑empty.
  - Or temporarily disable strict offline (remove `?strict_offline=1`, clear
    localStorage flag).

## WebSocket/MQTT won’t connect on HTTPS

- Symptom: Connections to `ws://` are blocked, or broker reports Origin errors.
- Fix:
  - Use `wss://` when the page is served over `https://` (mixed content is
    blocked by browsers).
  - Configure the server/broker to allow your site’s `Origin` header value.

## The app tries to fetch from the internet (CDN) when I’m offline

- Fix:
  - Enable strict offline mode to block CDN fallback.
  - Ensure the vendored MQTT bundle is present if you use the MQTT tab.

## The fonts or MQTT bundle 404 with SPA content returned

- Symptom: Request to `.woff2` or `.mjs` returns HTML (index page) rather than
  the asset.
- Fix:
  - Ensure you’re requesting the correct path under `/web/...`.
  - Avoid SPA fallback for explicit asset routes; the bundled server already
    does this.
