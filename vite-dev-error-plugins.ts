import type { Plugin, ViteDevServer } from "vite";

/**
 * Dev-only Vite plugins that surface errors TanStack Start's server
 * pipeline otherwise swallows into a generic response, pushed to the
 * browser over the existing Vite HMR WebSocket as custom events (the
 * client-side listener lives wherever the app chooses to subscribe --
 * these plugins only emit). Complements the production-side error
 * interception in src/server.ts/src/lib/error-capture.ts, which exists for
 * the same underlying reason (see NAS_DEPLOYMENT.md): h3/Vinxi convert
 * loader/rendering exceptions into an opaque `{"unhandled":true}` JSON
 * payload with no stack trace anywhere.
 */

const SSR_CAPTURE_KEY = "__ROOM_PLANNER_CAPTURE_SSR_ERROR__";

/** Captures uncaught errors/rejections during dev SSR rendering and pushes
 * them to the browser (as a `server-ssr-error` HMR event) whenever a
 * response comes back >=500 -- otherwise a server-side rendering exception
 * just shows up as an opaque 500 with no indication of what threw. */
export function devSsrErrorLogger(): Plugin {
  let lastCapture: { error: unknown; at: number } | undefined;
  const CAPTURE_TTL_MS = 5000;

  const capture = (error: unknown) => {
    lastCapture = { error, at: Date.now() };
  };
  const consumeCapture = (): unknown => {
    if (!lastCapture) return undefined;
    if (Date.now() - lastCapture.at > CAPTURE_TTL_MS) {
      lastCapture = undefined;
      return undefined;
    }
    const { error } = lastCapture;
    lastCapture = undefined;
    return error;
  };

  return {
    name: "dev-ssr-error-logger",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      (globalThis as Record<string, unknown>)[SSR_CAPTURE_KEY] = capture;
      const g = globalThis as unknown as {
        addEventListener?: (type: string, listener: (event: unknown) => void) => void;
      };
      if (typeof g.addEventListener === "function") {
        g.addEventListener("error", (e) => capture((e as ErrorEvent).error ?? e));
        g.addEventListener("unhandledrejection", (e) =>
          capture((e as PromiseRejectionEvent).reason),
        );
      }
      const onUnhandledRejection = (reason: unknown) => capture(reason);
      process.on("unhandledRejection", onUnhandledRejection);
      server.httpServer?.once("close", () => {
        process.off("unhandledRejection", onUnhandledRejection);
      });

      server.middlewares.use((_req, res, next) => {
        const origEnd = res.end.bind(res);
        res.end = (...args: unknown[]) => {
          if (res.statusCode >= 500) {
            const captured = consumeCapture();
            let err: { name: string; message: string; stack?: string } | null;
            if (captured instanceof Error) {
              err = { name: captured.name, message: captured.message, stack: captured.stack };
            } else if (typeof captured === "string" && captured.length > 0) {
              err = { name: "Error", message: captured };
            } else {
              err = null;
            }
            try {
              server.ws.send({
                type: "custom",
                event: "server-ssr-error",
                data: err ?? { name: "Error", message: "SSR rendering failed" },
              });
            } catch {
              // Best-effort -- a WS send failure here shouldn't break the response.
            }
          }
          return origEnd(...(args as Parameters<typeof origEnd>));
        };
        next();
      });
    },
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/");
      const isTargetModule =
        normalizedId.includes("/@tanstack/start-server-core/src/request-response.ts") ||
        normalizedId.includes("/@tanstack/start-server-core/dist/esm/request-response.js");
      if (!isTargetModule) return null;

      const needle = "handler(request, requestOpts)";
      if (!code.includes(needle)) return null;

      return code.replace(
        needle,
        `Promise.resolve(${needle}).catch((err) => { globalThis.${SSR_CAPTURE_KEY}?.(err); throw err; })`,
      );
    },
  };
}

const SERVER_FN_HMR_SEND_KEY = "__ROOM_PLANNER_SERVER_FN_HMR_SEND__";

/** Forwards a TanStack server function's captured error (normally just
 * folded into its result payload and left for the caller to notice) to the
 * browser as a `server-fn-error` HMR event, so a failing server function
 * shows up immediately during dev instead of silently returning `res.error`
 * with nothing printed anywhere. */
export function devServerFnErrorLogger(): Plugin {
  return {
    name: "dev-server-fn-error-logger",
    apply: "serve",
    enforce: "pre",
    configureServer(server: ViteDevServer) {
      (globalThis as Record<string, unknown>)[SERVER_FN_HMR_SEND_KEY] = (data: unknown) => {
        server.ws.send({ type: "custom", event: "server-fn-error", data });
      };
    },
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, "/");
      const isTargetModule =
        normalizedId.includes("/@tanstack/start-server-core/src/server-functions-handler.ts") ||
        normalizedId.includes("/@tanstack/start-server-core/dist/esm/server-functions-handler.js");
      if (!isTargetModule) return null;

      const needle = "const unwrapped = res.result || res.error";
      if (!code.includes(needle)) return null;

      return code.replace(
        needle,
        `${needle}

      if (res?.error) {
        const err = res.error
        const payload = {
          source: 'tanstack',
          type: 'server-fn-error',
          method: request.method,
          url: request.url,
          name: err?.name ?? 'Error',
          message: err?.message ?? String(err),
          stack: typeof err?.stack === 'string' ? err.stack : undefined,
        }
        globalThis.${SERVER_FN_HMR_SEND_KEY}?.(payload)
      }`,
      );
    },
  };
}
