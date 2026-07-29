# NAS Deployment Manifest & Blueprint
This document serves as a guide and template for deploying **TanStack Start applications** directly to a self-hosted **Docker container (via Portainer)** on a **home NAS** (Synology, QNAP, etc.).

It details how to bypass Cloudflare's runtime dependency (`workerd`/Wrangler) while keeping build compatibility, and how to rewrite SSR error handling to prevent swallowed stack traces.

---

## 📋 The Problem Statement

1. **The Cloudflare Lock-in**: this project's `vite.config.ts` uses `@cloudflare/vite-plugin` (at build time only) to produce a Cloudflare Pages Worker bundle (`dist/server/index.js`) — a natural fit if you deploy to Cloudflare, but not something a home NAS can run directly.
2. **Workerd NAS Compatibility**: Running the default production preview command (`bun run preview`) runs `workerd` (Cloudflare Workers runtime). This binary frequently crashes or fails to start on consumer NAS devices because:
   - It requires specific CPU instruction sets (e.g., **AVX instructions**), which are missing on Intel Celeron/Pentium/Atom or older ARM processors commonly used in NAS hardware.
   - It runs virtualized V8 isolates which carry high memory overhead.
3. **Swallowed SSR Stack Traces**: The underlying H3/Vinxi server framework in TanStack Start swallows loader and rendering exceptions, converting them into a generic JSON error payload (`{"unhandled":true,"message":"HTTPError"}`). In a Dockerized production environment, this makes debugging server-side errors impossible since no stack trace is written to standard output.

---

## 🛠️ The Solution Blueprint

We solve this using a two-pronged approach:
1. **Lightweight Bun Serve Shim (`entry.js`)**: Bypasses the heavy Wrangler preview server entirely. It uses Bun's ultra-fast native HTTP server (`Bun.serve`) to host the static assets and directly load and execute the Cloudflare Worker bundle (`dist/server/index.js`).
2. **SSR Error Interception (`server.ts` + Capture Libs)**: Hooks into the server entry point to intercept H3's swallowed exceptions, logging the real stack trace to the console and serving a fallback error page instead of raw JSON.

---

## 📁 Required Files & Setup

For a fresh TanStack Start + Cloudflare-adapter project, copy or create the following files:

### 1. `entry.js` (Project Root)
This is the production server entry point. It loads the compiled Worker bundle and serves static files from `dist/client`.

```javascript
import worker from "./dist/server/index.js";
import { join } from "path";

const CLIENT_DIR = join(import.meta.dir, "dist/client");

Bun.serve({
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  async fetch(request) {
    const url = new URL(request.url);

    // 1. Serve static files from the client directory first
    if (url.pathname !== "/") {
      const filePath = join(CLIENT_DIR, url.pathname);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    // 2. Delegate to the TanStack Cloudflare Worker handler
    // We pass process.env as bindings so container env vars are forwarded.
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
```

---

### 2. `Dockerfile` (Project Root)
A streamlined, single-stage Dockerfile that builds the application and starts it using the `entry.js` runner.

```dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# System libs (ca-certificates required for outbound HTTPS API calls)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
	rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy source code and build for production
COPY . .
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000

# Health check to ensure Bun server is answering HTTP requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
	CMD bun -e "fetch('http://127.0.0.1:3000').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "entry.js"]
```

---

### 3. `src/server.ts` (SSR Wrapper)
Redirects the default TanStack Start entry to intercept errors. Put this in `src/server.ts`.

```typescript
import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
```

---

### 4. `src/lib/error-capture.ts`
Hooks into global events to cache errors that are thrown during SSR rendering so they can be logged when the server encounters a 500.

```typescript
// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
```

---

### 5. `src/lib/error-page.ts`
Provides a user-friendly HTML error fallback page instead of a raw JSON payload in case of server crashes.

```typescript
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
```

---

### 6. `vite.config.ts`
This project's `vite.config.ts` (root of the repo) is a plain, direct Vite config with no third-party wrapper — see that file for the full, current version. The two things that matter for this deployment blueprint specifically:

- The `tanstackStart(...)` plugin call passes `server: { entry: "server" }`, redirecting TanStack Start's bundled server entry to `src/server.ts` (the SSR error wrapper above) instead of its own default.
- The `@cloudflare/vite-plugin` import is conditional on `command === "build"`, so `vite dev` never touches `workerd` at all — only `vite build` produces the Cloudflare Worker bundle format `entry.js` loads.

---

## 🐳 Portainer / NAS Deployment Configuration

When setting up your stack or container in Portainer, use the following guidelines:

### 1. Build Config / Compose File
If you build from git directly in Portainer, or run a local registry, use this simple Compose format:

```yaml
version: '3.8'

services:
  room-planner:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: room-planner
    ports:
      - "8080:3000" # Expose app on Port 8080 (or any free port on the NAS)
    environment:
      - PORT=3000
      - NODE_ENV=production
      - SUPABASE_URL=https://your-project.supabase.co # Example Env Vars
      - SUPABASE_ANON_KEY=your-anon-key
      - OPENAI_API_KEY=your-openai-api-key
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

### 2. Portainer Environment Variable Injection
Because we pass `process.env` into `worker.fetch(request, process.env, ctx)` inside `entry.js`, **any environment variable declared in Portainer's UI will be automatically injected into your TanStack server functions and SSR handlers**.
- Access them on the client via server functions using standard Node/Bun properties (`process.env.VAR_NAME`).
- No need to compile them in at build time unless they are prefixed with `VITE_` (Vite client-side env injection).
