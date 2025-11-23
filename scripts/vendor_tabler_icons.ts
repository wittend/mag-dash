// Deno script to vendor Tabler Icons webfont assets locally for offline use.
// Usage:
//   deno run -A scripts/vendor_tabler_icons.ts [version]
// Example:
//   deno run -A scripts/vendor_tabler_icons.ts 3.35.0

// This script will:
// - Download tabler-icons.min.css for the specified version from CDN (tries a few URLs).
// - Parse @font-face src URLs and download required font files (.woff2/.woff/.ttf if present).
// - Rewrite the CSS to reference local files under a deterministic `fonts/` subfolder (no query strings).
// - Save everything under web/vendor/tabler/icons-webfont/<version>/(tabler-icons.min.css + fonts/*)

const VERSION = Deno.args[0] || "3.35.0";
const BASE_DIR = new URL(`../web/vendor/tabler/icons-webfont/${VERSION}/`, import.meta.url);
const FONTS_DIR = new URL(`fonts/`, BASE_DIR);

// Candidate CSS URLs to try (some registries keep CSS under /dist)
const CSS_CANDIDATES = [
  // jsDelivr — known-good path uses /dist
  `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@${VERSION}/dist/tabler-icons.min.css`,
  `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@${VERSION}/tabler-icons.min.css`,
  // unpkg variants
  `https://unpkg.com/@tabler/icons-webfont@${VERSION}/dist/tabler-icons.min.css`,
  `https://unpkg.com/@tabler/icons-webfont@${VERSION}/tabler-icons.min.css`,
];

async function ensureDir(url: URL) {
  await Deno.mkdir(url, { recursive: true });
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf;
}

async function writeFile(dir: URL, name: string, data: Uint8Array) {
  const dest = new URL(name, dir);
  await Deno.writeFile(dest, data);
  return dest;
}

function rewriteCss(css: string, mappings: Record<string, string>): string {
  // Replace each remote URL with local relative path (just the filename)
  let out = css;
  for (const [remote, localName] of Object.entries(mappings)) {
    const escaped = remote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    out = out.replace(re, localName);
  }
  return out;
}

function unique<T>(arr: T[]): T[] { return [...new Set(arr)]; }

async function main() {
  console.log(`Vendoring Tabler Icons webfont v${VERSION}...`);
  await ensureDir(BASE_DIR);
  await ensureDir(FONTS_DIR);

  // 1) Fetch CSS
  let cssUrl = "";
  let cssBuf: Uint8Array | null = null;
  for (const cand of CSS_CANDIDATES) {
    try {
      console.log(`Trying CSS: ${cand}`);
      cssBuf = await download(cand);
      cssUrl = cand;
      break;
    } catch (_e) {
      // try next
    }
  }
  if (!cssBuf || !cssUrl) {
    throw new Error(
      `Failed to fetch Tabler Icons CSS for v${VERSION} from known CDNs. Tried:\n` +
      CSS_CANDIDATES.map((u) => ` - ${u}`).join("\n"),
    );
  }
  console.log(`Using CSS: ${cssUrl}`);
  const cssText = new TextDecoder().decode(cssBuf);

  // 2) Extract font URLs
  const urlRe = /url\(([^)]+)\)/g;
  // Keep both the literal token from CSS and the resolved absolute URL
  const urlPairs: { literal: string; absolute: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(cssText))) {
    const literal = m[1].trim().replace(/^['"]|['"]$/g, "");
    if (literal.startsWith("data:")) continue; // skip if ever embedded
    let absolute = literal;
    if (!absolute.startsWith("http")) {
      try {
        absolute = new URL(absolute, cssUrl).toString();
      } catch {
        // leave as-is; download may fail and be reported later
      }
    }
    urlPairs.push({ literal, absolute });
  }
  const fontPairs = urlPairs.filter(p => /\.(woff2?|ttf|eot)(\?|$)/.test(p.absolute));
  const uniqueAbs = unique(fontPairs.map(p => p.absolute));
  if (!fontPairs.length) {
    console.warn("No font URLs detected. The CSS may have changed format.");
  }

  // 3) Download fonts
  const mappings: Record<string, string> = {};
  for (const u of uniqueAbs) {
    const basename = u.split("/").pop()!.split("?")[0];
    const localRel = `fonts/${basename}`; // deterministic, no query
    console.log(`Downloading font: ${u}`);
    const data = await download(u);
    await writeFile(FONTS_DIR, basename, data);
    // Map the absolute URL to local path
    mappings[u] = localRel;
  }
  // Also map the literal tokens (e.g., "fonts/tabler-icons.woff2?v=3.35.0") to our deterministic path
  for (const { literal, absolute } of fontPairs) {
    const basename = absolute.split("/").pop()!.split("?")[0];
    const localRel = `fonts/${basename}`;
    mappings[literal] = localRel;
  }

  // 4) Rewrite and save CSS
  const rewritten = rewriteCss(cssText, mappings);
  await writeFile(BASE_DIR, "tabler-icons.min.css", new TextEncoder().encode(rewritten));

  // 5) Write a small README with license pointer
  const readme = `Tabler Icons (webfont) v${VERSION}\n\n` +
    `Source CSS: ${cssUrl}\n` +
    `This directory is auto-generated by scripts/vendor_tabler_icons.ts\n` +
    `Files:\n` +
    `  - tabler-icons.min.css (rewritten to local fonts/* paths, no query strings)\n` +
    `  - fonts/ (downloaded .woff2/.woff/.ttf files)\n` +
    `License: MIT (https://github.com/tabler/tabler-icons)\n`;
  await writeFile(BASE_DIR, "README.txt", new TextEncoder().encode(readme));

  console.log("Done. Local CSS and font files written to:");
  console.log(new URL("./", BASE_DIR).pathname);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
