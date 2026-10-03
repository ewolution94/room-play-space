// Minimal Node ESM loader hook that resolves this project's "@/" path
// alias (normally handled by Vite/tsconfig-paths at bundle time) to a
// real file:// URL under src/, so tests can run source files directly
// with Node's native TypeScript stripping -- no bundler, no new deps.
//
// Also stubs out static asset imports (Vite normally turns e.g.
// `import img from "./foo.png"` into a resolved URL string at build time).
// Under plain Node there's no such transform, so we short-circuit any
// asset-extension import to a synthetic module that default-exports a
// placeholder string -- good enough for loading modules that merely
// reference an asset path without needing its real content.
//
// And compiles .tsx (components) with the project's own TypeScript, since
// Node's type stripping doesn't do JSX: enough for a test to render a
// component with react-dom/server and look at the markup.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const SRC_ROOT = pathToFileURL(path.resolve(import.meta.dirname, "../../src") + "/").href;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rewritten = SRC_ROOT + specifier.slice(2);
    if (ASSET_EXT.test(rewritten)) {
      return { url: rewritten, shortCircuit: true };
    }
    // A module is a .ts file unless only a .tsx one exists.
    const ext = existsSync(fileURLToPath(rewritten + ".ts")) ? ".ts" : ".tsx";
    return nextResolve(rewritten + ext, context);
  }
  if (ASSET_EXT.test(specifier)) {
    return nextResolve(specifier, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (ASSET_EXT.test(url)) {
    return {
      format: "module",
      source: `export default ${JSON.stringify(url)};`,
      shortCircuit: true,
    };
  }
  if (url.startsWith("file:") && url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
