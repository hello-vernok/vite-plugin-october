/**
 * Dev-server metadata and origin helpers for October Vite plugins.
 */
import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { ConfigEnv, UserConfig, ViteDevServer } from "vite";
import { VITE_DEV_METADATA_FILENAME } from "./constants.js";

/**
 * Resolve the absolute path to `.vite-dev.json` for a Vite project root.
 *
 * @param rootDir Vite project root directory
 * @returns Absolute path to the dev metadata file
 */
export function resolveViteDevMetadataPath(rootDir: string): string {
  return path.resolve(rootDir, VITE_DEV_METADATA_FILENAME);
}

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

  try {
    const rootDir = server.config.root ? path.resolve(server.config.root) : process.cwd();
    const metaPath = resolveViteDevMetadataPath(rootDir);
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
 * Setup the `.vite-dev.json` metadata lifecycle.
 *
 * @param server Vite dev server
 * @param debug Enable debug logging
 * @param log Prefixed logger
 */
export function setupViteDevMetadata(server: ViteDevServer, debug: boolean, log: (...args: unknown[]) => void): void {
  const rootDir = server.config.root ? path.resolve(server.config.root) : process.cwd();
  const devMetaPath = resolveViteDevMetadataPath(rootDir);

  const writeDevMetadata = async () => {
    try {
      const origin = resolveViteDevOrigin(server);
      const payload = {
        ...(origin ? { origin } : {}),
        pid: process.pid,
        mode: "dev" as const
      };
      await fs.writeFile(devMetaPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      debug && log("wrote dev metadata", devMetaPath, payload);
      if (!origin) debug && log("dev-origin-unknown; wrote metadata without origin", devMetaPath);
    } catch (e) {
      debug && log(`failed-writing-${VITE_DEV_METADATA_FILENAME}`, e);
    }
  };

  const removeDevMetadata = async () => {
    try {
      await fs.unlink(devMetaPath);
      debug && log("removed dev metadata", devMetaPath);
    } catch (e: any) {
      if (e && e.code !== "ENOENT") debug && log(`failed-removing-${VITE_DEV_METADATA_FILENAME}`, e);
    }
  };

  void writeDevMetadata();

  const onServerListening = () => {
    void writeDevMetadata();
  };
  if (server.httpServer) server.httpServer.once("listening", onServerListening);

  const onServerClose = () => {
    void removeDevMetadata();
  };
  if (server.httpServer) server.httpServer.once("close", onServerClose);

  const onSig = () => {
    void removeDevMetadata();
  };
  process.once("SIGINT", onSig);
  process.once("SIGTERM", onSig);
  process.once("exit", () => {
    void removeDevMetadata();
  });
}
