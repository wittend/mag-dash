<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Acknowledgments and third-party notices

This project bundles or references third-party assets:

## Tabler Icons

- Source: https://github.com/tabler/tabler-icons
- License: MIT
- Vendored under `web/vendor/tabler/icons-webfont/3.35.0/` for offline use. The
  CSS references local `fonts/` URLs.

## MQTT ESM bundle

- Source for generation: https://esm.sh/mqtt@5
- Purpose: provides `mqtt.connect(...)` for the MQTT‑over‑WebSocket data source.
- Vendored path: `web/vendor/mqtt/mqtt.bundle.mjs`
- The project includes `web/vendor/mqtt/LICENSE-mqtt.txt` and `README.txt` with
  additional details.

If you update vendored assets, ensure their license notices are kept alongside
the files and update this page if licenses or versions change.
