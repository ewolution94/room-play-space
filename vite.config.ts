import { defineConfig, loadEnv, mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devServerFnErrorLogger, devSsrErrorLogger } from "./vite-dev-error-plugins";

// Plain Vite config -- this app no longer depends on any Lovable tooling
// (previously wrapped by @lovable.dev/vite-tanstack-config). This file
// reproduces everything that wrapper actually did for a real (non-sandbox,
// self-hosted) deployment, minus the Lovable-platform-only pieces it also
// carried: the componentTagger (JSX source tagging for Lovable's visual
// editor), the sandbox-only hmr-gate/dev-server-bridge plugins, sandbox env
// detection/config validation, and -- deliberately -- the artificial 1s
// server.watch.awaitWriteFinish debounce it forced on every local dev
// server (confirmed via profiling to measurably slow down every HMR update
// for no benefit outside Lovable's own sandboxed file system). Vite's own
// default watcher behavior (no debounce) applies here instead.
export default defineConfig(async ({ command, mode }: ConfigEnv): Promise<UserConfig> => {
  // Cloudflare Worker build output -- only needed for `vite build` (the dev
  // server runs plain Node, not workerd). wrangler.jsonc's `main` alone
  // isn't sufficient; this plugin is what actually produces
  // dist/server/index.js in the Worker bundle format entry.js loads (see
  // NAS_DEPLOYMENT.md). Resolved up front so it can slot into the plugins
  // array in the same position the original config used.
  const cloudflarePlugin =
    command === "build"
      ? [(await import("@cloudflare/vite-plugin")).cloudflare({ viteEnvironment: { name: "ssr" } })]
      : [];

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Dev-only DX plugins that surface errors TanStack Start's server
    // pipeline otherwise swallows -- see vite-dev-error-plugins.ts.
    devServerFnErrorLogger(),
    devSsrErrorLogger(),
    ...cloudflarePlugin,
    // Redirects TanStack Start's bundled server entry to src/server.ts (our
    // SSR error wrapper -- see NAS_DEPLOYMENT.md for why). importProtection
    // keeps server-only modules out of the client bundle.
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  // Vite already exposes VITE_-prefixed env vars via import.meta.env
  // automatically for client code, but the Cloudflare Worker SSR bundle
  // needs them inlined at build time too (no process.env access there) --
  // this define block covers that case explicitly.
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return mergeConfig(
    { server: { host: "::" as const, port: 8080 } },
    {
      define,
      resolve: {
        alias: { "@": `${process.cwd()}/src` },
        dedupe: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "@tanstack/react-query",
          "@tanstack/query-core",
        ],
      },
      plugins,
    },
  );
});
