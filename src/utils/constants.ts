/**
 * Shared asset extension sets for October Vite plugins.
 */
export const FONT_EXTENSIONS = new Set(["woff", "woff2", "ttf", "otf", "eot"]);
export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico"]);

export const STATIC_ASSET_EXTENSIONS = new Set([...FONT_EXTENSIONS, ...IMAGE_EXTENSIONS]);

/**
 * Dev metadata file written at the Vite project root while `vite dev` is running.
 * Consumed by Vernok.Vite on the PHP side.
 */
export const VITE_DEV_METADATA_FILENAME = ".vite-dev.json";
