// Simple Deno HTTP server to host the dashboard SPA from the ./web folder
// and provide a couple of utility endpoints.

const WEB_ROOT = new URL("./web/", import.meta.url);

export function contentType(pathname: string): string {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response> {
  // prevent directory traversal
  const safePath = pathname.replace(/\.\.+/g, "");
  const url = new URL(safePath, WEB_ROOT);
  try {
    const file = await Deno.readFile(url);
    return new Response(file, { headers: { "content-type": contentType(pathname) } });
  } catch (_err) {
    // fallback to index.html for SPA routing
    try {
      const indexUrl = new URL("index.html", WEB_ROOT);
      const file = await Deno.readFile(indexUrl);
      return new Response(file, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  }
}

if (import.meta.main) {
  console.log("mag-dash server starting on http://localhost:8000");
  Deno.serve({ port: 8000 }, async (req) => {
    const { pathname } = new URL(req.url);

    // health check
    if (pathname === "/healthz") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }

    // simple server time endpoint
    if (pathname === "/api/time") {
      return Response.json({ now: new Date().toISOString() });
    }

    // static files (served from ./web)
    // Normalize request path to a relative path under WEB_ROOT
    if (
      pathname === "/" ||
      pathname.startsWith("/web/") ||
      pathname.match(/\.(html|css|js|svg|ico|json)$/)
    ) {
      let rel = "";
      if (pathname === "/") {
        rel = "index.html";
      } else if (pathname.startsWith("/web/")) {
        rel = pathname.slice(5); // strip leading "/web/"
      } else {
        rel = pathname.replace(/^\/+/, "");
      }
      return await serveStatic(rel);
    }

    // default static fallback
    return await serveStatic(pathname);
  });
}
