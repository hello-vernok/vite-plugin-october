import type { Plugin, ViteDevServer } from "vite";
import { resolveViteDevOrigin, setupViteDevMetadata } from "./dev.js";
import { installStaticAssetMiddleware } from "./static-serve.js";
import { rewriteAbsoluteCssUrlsInDev } from "./css-dev.js";

const CSS_LIKE_ID_MARKERS = [
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
  ".stylus",
  "&lang.css",
  "type=style"
] as const;

const OCTOBER_ABSOLUTE_URL_PATTERN = /(\/resources\/|\/themes\/|\/modules\/|\/plugins\/)/i;
const CSS_URL_PATTERN = /url\s*\(/i;

/**
 * Mutable dev-server state shared by configureServer and the CSS transform hook.
 */
export interface OctoberDevState {
  devOriginForCss: string | null;
  viteDevServerForCss: ViteDevServer | null;
}

/**
 * Create initial dev-server state for an October plugin instance.
 *
 * @returns Empty dev state container
 */
export function createOctoberDevState(): OctoberDevState {
  return {
    devOriginForCss: null,
    viteDevServerForCss: null
  };
}

/**
 * Whether a Vite module id should be treated as CSS-like content for URL rewriting.
 *
 * @param id Vite module id
 * @returns True when the id likely represents CSS output
 */
export function isCssLikeModuleId(id: string): boolean {
  const lowerId = id.toLowerCase();
  return CSS_LIKE_ID_MARKERS.some((marker) => lowerId.includes(marker));
}

/**
 * Register October dev-server integrations: origin resolution, markers, static assets.
 *
 * @param server Vite dev server
 * @param state Mutable dev state for later transform passes
 * @param debug Enable debug logging
 * @param log Prefixed logger
 */
export function configureOctoberDevServer(
  server: ViteDevServer,
  state: OctoberDevState,
  debug: boolean,
  log: (...args: unknown[]) => void
): void {
  state.viteDevServerForCss = server;
  state.devOriginForCss = resolveViteDevOrigin(server);

  if (!state.devOriginForCss && server.httpServer) {
    server.httpServer.once("listening", () => {
      state.devOriginForCss = resolveViteDevOrigin(server);
      if (state.devOriginForCss && !server.config.server.origin) {
        server.config.server.origin = state.devOriginForCss;
      }
      if (state.devOriginForCss) {
        try {
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: "full-reload", path: "*" });
        } catch {
          // best-effort only
        }
      }
    });
  }

  setupViteDevMetadata(server, debug, log);
  installStaticAssetMiddleware(server, debug, log);
}

/**
 * Build the shared dev-time CSS transform hook used by plugin and theme variants.
 *
 * @param enabled Whether the parent plugin is enabled
 * @param state Mutable dev state populated by configureOctoberDevServer
 * @param debug Enable debug logging
 * @param log Prefixed logger
 * @returns Vite transform hook
 */
export function createOctoberCssTransformHook(
  enabled: boolean,
  state: OctoberDevState,
  debug: boolean,
  log: (...args: unknown[]) => void
): NonNullable<Plugin["transform"]> {
  return (code: string, id: string) => {
    if (!enabled || typeof code !== "string" || !isCssLikeModuleId(id)) {
      return;
    }

    if (!CSS_URL_PATTERN.test(code) || !OCTOBER_ABSOLUTE_URL_PATTERN.test(code)) {
      return;
    }

    if (!state.devOriginForCss && state.viteDevServerForCss) {
      state.devOriginForCss = resolveViteDevOrigin(state.viteDevServerForCss);
    }

    const rewritten = rewriteAbsoluteCssUrlsInDev(code, state.devOriginForCss);
    if (rewritten !== code) {
      debug && log("dev-time css url rewrite", id, "origin=", state.devOriginForCss);
      return rewritten;
    }

    if (debug && !state.devOriginForCss) {
      log("dev-time css url rewrite skipped (origin unknown)", id);
    }

    return;
  };
}
