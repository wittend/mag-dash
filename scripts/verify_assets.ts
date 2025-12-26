// SPDX-License-Identifier: GPL-3.0-or-later
// Simple verification script to ensure vendored assets exist
// (Tabler webfont and MQTT bundle) and look sane (non‑zero sizes).
// Exits non‑zero on failure.
// Usage: deno run -A scripts/verify_assets.ts [version]

const VERSION = Deno.args[0] || "3.35.0";
const TABLER_BASE = new URL(
  `../web/vendor/tabler/icons-webfont/${VERSION}/`,
  import.meta.url,
);
const MQTT_BUNDLE = new URL(
  `../web/vendor/mqtt/mqtt.bundle.mjs`,
  import.meta.url,
);

type Expect = { path: string; minBytes?: number; contentType?: string };

const EXPECT: Expect[] = [
  { path: `tabler-icons.min.css`, minBytes: 1024, contentType: "text/css" },
  {
    path: `fonts/tabler-icons.woff2`,
    minBytes: 1000,
    contentType: "font/woff2",
  },
  { path: `fonts/tabler-icons.woff`, minBytes: 1000, contentType: "font/woff" },
  // TTF is optional; include if present
];

function exists(url: URL): Promise<boolean> {
  return Deno.stat(url).then(() => true).catch(() => false);
}

async function main() {
  console.log(`Verifying vendored Tabler assets v${VERSION}...`);
  let ok = true;
  for (const e of EXPECT) {
    const u = new URL(e.path, TABLER_BASE);
    const present = await exists(u);
    if (!present) {
      console.error(`Missing: ${u.pathname}`);
      ok = false;
      continue;
    }
    const info = await Deno.stat(u);
    if (typeof e.minBytes === "number" && info.size < e.minBytes) {
      console.error(`Too small: ${u.pathname} (${info.size} bytes)`);
      ok = false;
    }
  }

  // Optional TTF check if CSS references it
  const cssUrl = new URL("tabler-icons.min.css", TABLER_BASE);
  const css = new TextDecoder().decode(await Deno.readFile(cssUrl));
  if (/fonts\/tabler-icons\.ttf/.test(css)) {
    const ttf = new URL("fonts/tabler-icons.ttf", TABLER_BASE);
    if (!(await exists(ttf))) {
      console.error(`CSS references TTF but file missing: ${ttf.pathname}`);
      ok = false;
    }
  }

  // Verify MQTT bundle exists for strict offline mode
  console.log(`Verifying vendored MQTT bundle...`);
  const mqttPresent = await exists(MQTT_BUNDLE);
  if (!mqttPresent) {
    console.error(`Missing MQTT bundle: ${MQTT_BUNDLE.pathname}`);
    ok = false;
  } else {
    const info = await Deno.stat(MQTT_BUNDLE);
    if (info.size < 1024) {
      console.error(
        `MQTT bundle too small: ${MQTT_BUNDLE.pathname} (${info.size} bytes)`,
      );
      ok = false;
    }
  }

  if (!ok) {
    console.error(
      "Verification failed. Try re-vendoring: deno task vendor:tabler",
    );
    Deno.exit(1);
  }
  console.log("OK: Vendored assets present and non-zero size.");
}

if (import.meta.main) main();
