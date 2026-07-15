// Bootstrap that registers the "@/" alias loader via the modern
// node:module register() API (the --experimental-loader CLI flag is
// deprecated in favor of this). Imported via `node --import`.
import { register } from "node:module";
register("./alias-loader.mjs", import.meta.url);
