// Minimal Node ESM loader hook that resolves this project's "@/" path
// alias (normally handled by Vite/tsconfig-paths at bundle time) to a
// real file:// URL under src/, so tests can run source files directly
// with Node's native TypeScript stripping -- no bundler, no new deps.
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC_ROOT = pathToFileURL(path.resolve(import.meta.dirname, "../../src") + "/").href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rewritten = SRC_ROOT + specifier.slice(2) + ".ts";
    return nextResolve(rewritten, context);
  }
  return nextResolve(specifier, context);
}
