import worker from "./dist/server/index.js";
import { join } from "path";

const CLIENT_DIR = join(import.meta.dir, "dist/client");

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
        return new Response(file);
      }
    }

    // Delegate to the TanStack Cloudflare Worker handler, passing process.env as bindings
    try {
      return await worker.fetch(request, process.env, {
        waitUntil(promise) {
          promise.catch((err) => console.error("Error in waitUntil:", err));
        }
      });
    } catch (e) {
      console.error("SSR Worker fetch error:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
});

console.log(`Production server running on http://0.0.0.0:${process.env.PORT || 3000}`);
