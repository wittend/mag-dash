// Simple Deno HTTP server to host the dashboard SPA from the ./web folder
// and provide a couple of utility endpoints.

const WEB_ROOT = new URL("./web/", import.meta.url);

// Toggle server-side verbose logging via env. Default: off.
// Enable by setting MAGDASH_VERBOSE=1 (or true/on/yes) or DEBUG=1 when starting the server.
const VERBOSE: boolean = (() => {
  try {
    const v = Deno.env.get("MAGDASH_VERBOSE") ?? Deno.env.get("DEBUG") ?? "";
    return /^(1|true|on|yes)$/i.test(v);
  } catch {
    return false;
  }
})();

function log(..._args: unknown[]) {
  if (!VERBOSE) return;
  try {
    // Slightly formatted log with timestamp
    const ts = new Date().toISOString();
    console.log(`[${ts}]`, ..._args);
  } catch {
    // noop
  }
}

export function contentType(pathname: string): string {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js") || pathname.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".woff2")) return "font/woff2";
  if (pathname.endsWith(".woff")) return "font/woff";
  if (pathname.endsWith(".ttf")) return "font/ttf";
  if (pathname.endsWith(".eot")) return "application/vnd.ms-fontobject";
  return "application/octet-stream";
}

async function serveStatic(pathname: string, opts?: { spaFallback?: boolean }): Promise<Response> {
  // Normalize and prevent directory traversal
  const safePath = pathname.replace(/^\/+/, "");
  if (safePath.includes("..")) {
    log("serveStatic: traversal blocked", { pathname, safePath });
    return new Response("Not Found", { status: 404 });
  }
  const url = new URL(safePath, WEB_ROOT);
  try {
    const file = await Deno.readFile(url);
    const headers = new Headers({
      "content-type": contentType(pathname),
      // Disable caching during dev to avoid confusing stale assets after hard reloads
      "cache-control": "no-store",
    });
    // Log successful static serve in dev for diagnostics
    log("serveStatic: 200", { pathname, resolved: url.pathname, type: headers.get("content-type") });
    return new Response(file, { headers });
  } catch (_err) {
    log("serveStatic: miss", { pathname, resolved: url.pathname, spaFallback: !!opts?.spaFallback });
    if (opts?.spaFallback) {
      try {
        const indexUrl = new URL("index.html", WEB_ROOT);
        const file = await Deno.readFile(indexUrl);
        const headers = new Headers({
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        });
        log("serveStatic: SPA fallback 200 index.html");
        return new Response(file, { headers });
      } catch {
        log("serveStatic: SPA fallback failed to read index.html");
        return new Response("Not Found", { status: 404 });
      }
    }
    // No SPA fallback for non-HTML asset requests: return 404 so the browser/devtools show the real error
    log("serveStatic: 404 asset", { pathname });
    return new Response("Not Found", { status: 404 });
  }
}

export async function appHandler(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const accept = req.headers.get("accept") || "";
    // Treat clean paths without an extension as HTML navigations even if Accept is */*
    const noExt = !pathname.match(/\.[^./]+$/);
    const isHtmlNavigation = req.method === "GET" && (accept.includes("text/html") || accept.includes("*/*")) && noExt;
    log("request", { method: req.method, pathname, accept, isHtmlNavigation });

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
      pathname.match(/\.(html|css|js|svg|ico|json|woff2?|ttf|eot|txt)$/)
    ) {
      let rel = "";
      if (pathname === "/") {
        rel = "index.html";
      } else if (pathname.startsWith("/web/")) {
        rel = pathname.slice(5); // strip leading "/web/"
      } else {
        rel = pathname.replace(/^\/+/, "");
      }
      // For explicit asset requests, do not SPA-fallback; for "/" or clean navigations, allow fallback
      const allowSpa = pathname === "/" || isHtmlNavigation;
      log("route:static", { pathname, rel, allowSpa });
      return await serveStatic(rel, { spaFallback: allowSpa });
    }

    // default static fallback
    return await serveStatic(pathname, { spaFallback: isHtmlNavigation });
}

if (import.meta.main) {
  const portStr = Deno.env.get("PORT");
  const port = portStr ? Number(portStr) : 8000;
  const host = "0.0.0.0";
  log("mag-dash server starting", { port, webRoot: WEB_ROOT.pathname });
  try {
    Deno.serve({ port, hostname: host }, appHandler);
    log("Listening", { url: `http://localhost:${port}/` });
  } catch (err) {
    console.error("Failed to start server:", err?.message || err);
    console.error("Hint: Is the port in use? Try: PORT=8080 deno task dev");
    throw err;
  }
}
