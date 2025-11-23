import { assertEquals } from "@std/assert";
import { contentType, appHandler } from "./main.ts";

Deno.test("contentType maps common extensions", () => {
  assertEquals(contentType("/index.html"), "text/html; charset=utf-8");
  assertEquals(contentType("/styles.css"), "text/css; charset=utf-8");
  assertEquals(contentType("/app.js"), "text/javascript; charset=utf-8");
  assertEquals(contentType("/icon.svg"), "image/svg+xml");
  assertEquals(contentType("/favicon.ico"), "image/x-icon");
  assertEquals(contentType("/data.json"), "application/json; charset=utf-8");
});

function req(path: string, init: RequestInit = {}): Request {
  const url = new URL(`http://localhost:8000${path}`);
  return new Request(url, init);
}

Deno.test("serves common assets with correct content types", async () => {
  const r1 = await appHandler(req("/web/styles.css"));
  assertEquals(r1.status, 200);
  assertEquals(r1.headers.get("content-type"), "text/css; charset=utf-8");

  const r2 = await appHandler(req("/web/app.js"));
  assertEquals(r2.status, 200);
  assertEquals(r2.headers.get("content-type"), "text/javascript; charset=utf-8");

  const r3 = await appHandler(req("/web/icon.svg"));
  assertEquals(r3.status, 200);
  assertEquals(r3.headers.get("content-type"), "image/svg+xml");
});

Deno.test("serves vendored tabler CSS and font with correct types", async () => {
  const css = await appHandler(req("/web/vendor/tabler/icons-webfont/3.35.0/tabler-icons.min.css"));
  assertEquals(css.status, 200);
  assertEquals(css.headers.get("content-type"), "text/css; charset=utf-8");

  const woff2 = await appHandler(req("/web/vendor/tabler/icons-webfont/3.35.0/fonts/tabler-icons.woff2"));
  assertEquals(woff2.status, 200);
  assertEquals(woff2.headers.get("content-type"), "font/woff2");
});

Deno.test("SPA fallback only for HTML navigations without extension", async () => {
  // HTML navigation (no extension) should serve index.html (200)
  const nav = await appHandler(req("/some/route", { headers: { accept: "text/html" } }));
  assertEquals(nav.status, 200);
  assertEquals(nav.headers.get("content-type"), "text/html; charset=utf-8");

  // Missing asset with extension should be 404 (no SPA fallback)
  const missingJs = await appHandler(req("/does-not-exist.js"));
  assertEquals(missingJs.status, 404);
});

Deno.test("path traversal attempts return 404", async () => {
  const resp = await appHandler(req("/web/../README.md"));
  assertEquals(resp.status, 404);
});
