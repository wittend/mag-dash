import { assertEquals } from "@std/assert";
import { contentType } from "./main.ts";

Deno.test("contentType maps common extensions", () => {
  assertEquals(contentType("/index.html"), "text/html; charset=utf-8");
  assertEquals(contentType("/styles.css"), "text/css; charset=utf-8");
  assertEquals(contentType("/app.js"), "text/javascript; charset=utf-8");
  assertEquals(contentType("/icon.svg"), "image/svg+xml");
  assertEquals(contentType("/favicon.ico"), "image/x-icon");
  assertEquals(contentType("/data.json"), "application/json; charset=utf-8");
});
