<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Data sources and protocols

`mag-dash` supports several ways to ingest data. This page explains each option and documents browser/security constraints.

## Local file (JSON Lines)

- Choose a file via the browser file picker.
- Format: one JSON object per line, e.g.

  ```json
  { "ts": "26 Oct 2025 14:20:00", "x": 123.456, "y": -78.9, "z": 5.0 }
  ```

- Header lines can be skipped via the UI.
- Works fully offline.

## WebSocket (JSON Lines over text frames)

- Enter a `ws://` or `wss://` URL.
- The server should send one JSON object per line in text frames.
- Cross‑origin WebSockets are usually allowed by browsers, but your server may restrict the `Origin` header. Configure an allowlist as needed.
- Mixed content rules apply: when the dashboard is served over `https://`, the browser blocks `ws://` (insecure). Use `wss://`.

## MQTT over WebSocket

- Enter a broker WebSocket URL (e.g., `ws://localhost:9001` or `wss://mqtt.example.com:443/mqtt`).
- You can specify username/password when required by the broker.
- The UI uses a vendored ESM bundle that provides `mqtt.connect(...)`.
- Broker requirements:
  - WebSocket (ws or wss) must be enabled on the broker.
  - When internet‑facing, configure allowed `Origin`s.
  - On `https://` pages, use `wss://` to avoid mixed content.

### Topics

- Provide a topic filter (e.g., `sensors/mag/#`).
- Messages should be text payloads containing a single JSON object per message (same schema as above).

## Schema

- Expected keys: `ts` (UTC timestamp string), `x`, `y`, `z` (numbers in nT).
- Values are displayed with three decimals; additional properties are preserved in the history table but not charted.
