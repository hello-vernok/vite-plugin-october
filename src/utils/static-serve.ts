import path from "node:path";
import fs from "node:fs/promises";
import type { ViteDevServer } from "vite";
import { STATIC_ASSET_EXTENSIONS } from "./constants.js";

const STATIC_URL_PREFIXES = ["/resources/", "/plugins/", "/modules/", "/themes/"] as const;

const MIME_TYPES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon"
};

/**
 * Install middleware to serve absolute asset URLs from the project during dev.
 *
 * @param server Vite dev server
 * @param debug Enable debug logging
 * @param log Prefixed logger
 */
export function installStaticAssetMiddleware(
  server: ViteDevServer,
  debug: boolean,
  log: (...args: unknown[]) => void
): void {
  const rootDir = server.config.root ? path.resolve(server.config.root) : process.cwd();

  const allow = server.config.server.fs?.allow;
  if (Array.isArray(allow) && !allow.includes(rootDir)) {
    allow.push(rootDir);
  }

  server.middlewares.use(async (req, res, next) => {
    try {
      const url = (req.url || "").split("?")[0];
      if (!url || url.startsWith("/@")) {
        return next();
      }

      const hit = STATIC_URL_PREFIXES.find((prefix) => url.startsWith(prefix));
      if (!hit) {
        return next();
      }

      const ext = url.toLowerCase().split(".").pop() || "";
      if (!STATIC_ASSET_EXTENSIONS.has(ext)) {
        return next();
      }

      const rel = url.replace(/^\//, "");
      const abs = path.resolve(rootDir, rel);
      if (!abs.startsWith(path.resolve(rootDir))) {
        return next();
      }

      try {
        const data = await fs.readFile(abs);
        res.statusCode = 200;
        res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
        debug && log("dev-serve-asset", url, "->", abs);
        return res.end(data);
      } catch {
        return next();
      }
    } catch {
      return next();
    }
  });
}
