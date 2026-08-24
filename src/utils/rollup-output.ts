import type { OutputOptions } from "rolldown";
import { MODULES_SHARED_CHUNK_DIR } from "./constants.js";

/**
 * Create Rolldown output options with October entry and CSS filename mapping.
 *
 * @param entryPath Resolve JS entry output path from chunk name
 * @param cssPath Resolve CSS asset output path from asset base name
 * @returns Rolldown output options fragment
 */
export function createOctoberRollupOutput(
  entryPath: (name: string) => string,
  cssPath: (name: string) => string
): Pick<OutputOptions, "entryFileNames" | "assetFileNames" | "chunkFileNames"> {
  return {
    entryFileNames(chunkInfo) {
      return entryPath(chunkInfo.name);
    },
    chunkFileNames: `${MODULES_SHARED_CHUNK_DIR}/[name]-[hash].js`,
    assetFileNames(assetInfo) {
      const names = assetInfo.names;
      const primary = (names && names.length > 0 ? names[0] : assetInfo.name) || "asset";
      if (primary.endsWith(".css")) {
        const baseCss = primary.replace(/\.[^.]+$/, "");
        return cssPath(baseCss);
      }
      return "[name]-[hash][extname]";
    }
  };
}
