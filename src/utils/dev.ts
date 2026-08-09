/**
 * Dev-server marker and origin helpers for October Vite plugins.
 */
import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { ConfigEnv, UserConfig, ViteDevServer } from "vite";

/**
 * Resolve the current Vite dev origin (including auto-selected/random port).
 * Returns null if it cannot be determined yet.
 */
export function resolveViteDevOrigin(server: ViteDevServer): string | null {
  const resolvedFromVite =
    server.resolvedUrls?.local?.[0] ||
    server.resolvedUrls?.network?.[0];
  if (resolvedFromVite) return resolvedFromVite.replace(/\/$/, "");

  const originFromConfig = server.config.server?.origin;
  if (originFromConfig) return String(originFromConfig).replace(/\/$/, "");

  const addr = server.httpServer?.address?.();
  if (addr && typeof addr === "object") {
    const info = addr as AddressInfo;
    const proto = server.config.server?.https ? "https" : "http";
    const host = info.address && info.address !== "::" ? info.address : "localhost";
    return `${proto}://${host}:${info.port}`;
  }

  // Fallback: read from `.vite-dev.json` if we already wrote it earlier.
  try {
    const rootDir = server.config.root ? path.resolve(server.config.root) : process.cwd();
    const metaPath = path.resolve(rootDir, ".vite-dev.json");
    if (fsSync.existsSync(metaPath)) {
      const raw = fsSync.readFileSync(metaPath, "utf8");
      const json = JSON.parse(raw) as { origin?: unknown };
      const origin = json.origin;
      if (typeof origin === "string" && origin) return origin.replace(/\/$/, "");
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Resolve an explicit dev-server origin override for the Vite config hook.
 *
 * @param env Vite command environment
 * @param userConfig User-provided Vite configuration
 * @param hostUrl Optional plugin host URL override
 * @returns Origin override when one should be applied
 */
export function resolveConfiguredDevOrigin(
  env: ConfigEnv,
  userConfig: UserConfig,
  hostUrl?: string
): string | undefined {
  if (env.command !== "serve" || userConfig.server?.origin) {
    return undefined;
  }

  return hostUrl || process.env.VITE_HOST_URL;
}

/**
 * Setup the .vite-dev marker lifecycle and .vite-dev.json metadata.
 * @param server Vite dev server
 * @param debug Enable debug logging
 * @param log Prefixed logger
 */
export function setupDevMarker(server: ViteDevServer, debug: boolean, log: (...args: unknown[]) => void): void {
  const rootDir = server.config.root ? path.resolve(server.config.root) : process.cwd();

  const devMarkerPath = path.resolve(rootDir, ".vite-dev");
  const devMetaPath = path.resolve(rootDir, ".vite-dev.json");

  const resolveOrigin = (): string | null => resolveViteDevOrigin(server);

  const writeDevMarker = async () => {
    try {
      await fs.writeFile(devMarkerPath, "", "utf8");
      debug && log("wrote dev marker", devMarkerPath);
    } catch (e) {
      debug && log("failed-writing-.vite-dev", e);
    }
  };
  const writeDevMeta = async () => {
    try {
      const origin = resolveOrigin();
      const payload = {
        ...(origin ? { origin } : {}),
        pid: process.pid,
        mode: "dev" as const
      };
      await fs.writeFile(devMetaPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      debug && log("wrote dev metadata", devMetaPath, payload);
      if (!origin) debug && log("dev-origin-unknown; wrote metadata without origin", devMetaPath);
    } catch (e) {
      debug && log("failed-writing-.vite-dev.json", e);
    }
  };
  const removeDevMarker = async () => {
    try {
      await fs.unlink(devMarkerPath);
      debug && log("removed dev marker", devMarkerPath);
    } catch (e: any) {
      if (e && e.code !== "ENOENT") debug && log("failed-removing-.vite-dev", e);
    }
  };
  const removeDevMeta = async () => {
    try {
      await fs.unlink(devMetaPath);
      debug && log("removed dev metadata", devMetaPath);
    } catch (e: any) {
      if (e && e.code !== "ENOENT") debug && log("failed-removing-.vite-dev.json", e);
    }
  };

  void writeDevMarker();
  void writeDevMeta();

  const onServerListening = () => {
    // Re-write metadata once the final port/origin is known.
    void writeDevMeta();
  };
  if (server.httpServer) server.httpServer.once("listening", onServerListening);

  const onServerClose = () => {
    void removeDevMarker();
    void removeDevMeta();
  };
  if (server.httpServer) server.httpServer.once("close", onServerClose);
  const onSig = () => {
    void removeDevMarker();
    void removeDevMeta();
  };
  process.once("SIGINT", onSig);
  process.once("SIGTERM", onSig);
  process.once("exit", () => {
    void removeDevMarker();
    void removeDevMeta();
  });
}
