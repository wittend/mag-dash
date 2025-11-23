// Simple verification script to ensure vendored Tabler webfont assets exist
// and look sane (non‑zero sizes). Exits non‑zero on failure.
// Usage: deno run -A scripts/verify_assets.ts [version]

const VERSION = Deno.args[0] || "3.35.0";
const BASE = new URL(`../web/vendor/tabler/icons-webfont/${VERSION}/`, import.meta.url);

type Expect = { path: string; minBytes?: number; contentType?: string };

const EXPECT: Expect[] = [
  { path: `tabler-icons.min.css`, minBytes: 1024, contentType: "text/css" },
  { path: `fonts/tabler-icons.woff2`, minBytes: 1000, contentType: "font/woff2" },
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
    const u = new URL(e.path, BASE);
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
  const cssUrl = new URL("tabler-icons.min.css", BASE);
  const css = new TextDecoder().decode(await Deno.readFile(cssUrl));
  if (/fonts\/tabler-icons\.ttf/.test(css)) {
    const ttf = new URL("fonts/tabler-icons.ttf", BASE);
    if (!(await exists(ttf))) {
      console.error(`CSS references TTF but file missing: ${ttf.pathname}`);
      ok = false;
    }
  }

  if (!ok) {
    console.error("Verification failed. Try re-vendoring: deno task vendor:tabler");
    Deno.exit(1);
  }
  console.log("OK: Vendored assets present and non-zero size.");
}

if (import.meta.main) main();
