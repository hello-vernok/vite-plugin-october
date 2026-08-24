/**
 * Shared asset extension sets for October Vite plugins.
 */
export const FONT_EXTENSIONS = new Set(["woff", "woff2", "ttf", "otf", "eot"]);
export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico"]);

export const STATIC_ASSET_EXTENSIONS = new Set([...FONT_EXTENSIONS, ...IMAGE_EXTENSIONS]);

/**
 * Output directory for shared JS chunks imported by module entrypoints (plugins and themes).
 */
export const MODULES_SHARED_CHUNK_DIR = "modules/_shared";

/**
 * Output directory for shared JS chunks reachable from a theme root entrypoint.
 */
export const JS_SHARED_CHUNK_DIR = "js/_shared";

/**
 * Reserved module folder name — not autodiscovered as an entry module.
 */
export const RESERVED_MODULE_FOLDER = "_shared";

/**
 * Dev metadata file written at the Vite project root while `vite dev` is running.
 * Consumed by Vernok.Vite on the PHP side.
 */
export const VITE_DEV_METADATA_FILENAME = ".vite-dev.json";
