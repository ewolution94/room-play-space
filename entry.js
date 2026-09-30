import worker from "./dist/server/index.js";
import { join } from "path";

const CLIENT_DIR = join(import.meta.dir, "dist/client");

// Vite fingerprints everything under /assets/, so those can be kept forever,
// and the Kenney models never change in place. Every other file keeps its name
// across deploys and is revalidated, which matters most for sw.js: behind
// Cloudflare, a file with no Cache-Control is held at the edge for hours, and
// a new service worker wouldn't reach anyone.
function cacheControl(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/models/")) return "public, max-age=604800";
  return "no-cache";
}

Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  async fetch(request) {
    const url = new URL(request.url);

    // Serve static files from the client directory
    if (url.pathname !== "/") {
      const filePath = join(CLIENT_DIR, url.pathname);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, { headers: { "cache-control": cacheControl(url.pathname) } });
      }
    }

    // Delegate to the TanStack Cloudflare Worker handler, passing process.env as bindings
    try {
      return await worker.fetch(request, process.env, {
        waitUntil(promise) {
          promise.catch((err) => console.error("Error in waitUntil:", err));
        },
      });
    } catch (e) {
      console.error("SSR Worker fetch error:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

console.log(`Production server running on http://0.0.0.0:${process.env.PORT || 3000}`);
