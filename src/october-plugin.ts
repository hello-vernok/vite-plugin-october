import fg from "fast-glob";
import path from "node:path";
import type { Plugin, UserConfig, ConfigEnv } from "vite";
import { resolveConfiguredDevOrigin } from "./utils/dev.js";
import { configureOctoberDevServer, createOctoberCssTransformHook, createOctoberDevState } from "./utils/dev-hooks.js";
import { rewriteCssUrlsInBundle } from "./utils/css.js";
import { collectAssetOwners } from "./utils/bundle-owners.js";
import { relocatePluginAssets, type AssetContainerDirs } from "./utils/relocate-assets.js";
import { parseOctoberEntryName } from "./utils/entry-names.js";
import { createOctoberRollupOutput } from "./utils/rollup-output.js";

/**
 * Plugin options.
 */
export interface OctoberPluginOptions {
  enabled?: boolean;
  debug?: boolean;
  /**
   * Optional explicit host URL to write into .vite-dev.json during dev.
   * Useful when PHP runs inside Docker and cannot reach localhost.
   * Example: "http://host.docker.internal:5173".
   */
  hostUrl?: string;
}

/**
 * Discover entries for an OctoberCMS plugin repository.
 *
 * @param rootDir Plugin root directory
 * @returns Rollup input map keyed by internal entry names
 */
export function discoverPluginEntries(rootDir: string): Record<string, string> {
  const globs = [
    path.join(rootDir, "resources", "formwidgets", "*", "entrypoint.{ts,js}"),
    path.join(rootDir, "resources", "modules", "*", "entrypoint.{ts,js}")
  ].map((g) => g.replaceAll("\\", "/"));

  const files = fg.sync(globs, { dot: false, onlyFiles: true });
  const entries: Record<string, string> = {};

  for (const file of files) {
    const posixFile = file.replaceAll("\\", "/");
    const parts = posixFile.split("/");
    const idxRes = parts.indexOf("resources");
    if (idxRes === -1) continue;

    const kind = parts[idxRes + 1];
    if (kind === "formwidgets") {
      entries[`fw:${parts[idxRes + 2]}:entrypoint`] = path.resolve(file);
      continue;
    }

    if (kind === "modules") {
      entries[`mod:${parts[idxRes + 2]}:entrypoint`] = path.resolve(file);
    }
  }

  return entries;
}

/**
 * Resolve plugin asset container folders for an entry owner.
 *
 * @param owner Rollup entry chunk name
 * @returns Font and image output directories
 */
function pluginContainerDirs(owner: string): AssetContainerDirs {
  const parsed = parseOctoberEntryName(owner);
  if (parsed?.tag === "fw") {
    return {
      fonts: `formwidgets/${parsed.entryName}/fonts`,
      images: `formwidgets/${parsed.entryName}/images`
    };
  }
  if (parsed?.tag === "mod") {
    const base = `modules/${parsed.entryName}`;
    return { fonts: `${base}/fonts`, images: `${base}/images` };
  }

  return { fonts: `${owner}/fonts`, images: `${owner}/images` };
}

/**
 * Resolve plugin JS output path for a Rollup entry name.
 *
 * @param name Rollup entry chunk name
 * @returns Output path template
 */
function entryOutputPath(name: string): string {
  const parsed = parseOctoberEntryName(name);
  if (parsed?.tag === "fw") return `formwidgets/${parsed.entryName}/entrypoint-[hash].js`;
  if (parsed?.tag === "mod") return `modules/${parsed.entryName}/entrypoint-[hash].js`;
  return `${name}/entrypoint-[hash].js`;
}

/**
 * Resolve plugin CSS output path for a Rollup asset base name.
 *
 * @param name Rollup CSS asset base name
 * @returns Output path template
 */
function cssOutputPath(name: string): string {
  const parsed = parseOctoberEntryName(name);
  if (parsed?.tag === "fw") return `formwidgets/${parsed.entryName}/entrypoint-[hash].css`;
  if (parsed?.tag === "mod") return `modules/${parsed.entryName}/entrypoint-[hash].css`;
  return `${name}/entrypoint-[hash].css`;
}

/**
 * Vite plugin implementation for OctoberCMS plugin repos.
 *
 * @param options Plugin options
 * @returns Configured Vite plugin
 */
export function octoberPlugin(options: OctoberPluginOptions = {}): Plugin {
  const enabled = options.enabled ?? true;
  const debug = options.debug ?? false;
  const log = (...args: unknown[]) => {
    if (debug) console.log("[vernok-october-plugin]", ...args);
  };

  let projectRoot: string | null = null;
  const devState = createOctoberDevState();

  return {
    name: "vernok-october-plugin",
    enforce: "pre",

    config(userConfig: UserConfig, env: ConfigEnv) {
      if (!enabled) return;

      const rootDir = userConfig.root ? path.resolve(userConfig.root) : process.cwd();
      projectRoot = rootDir;
      const entries = discoverPluginEntries(rootDir);
      const hasEntries = Object.keys(entries).length > 0;
      debug && log("entries", entries);

      type RollupOptionsType = NonNullable<NonNullable<UserConfig["build"]>["rollupOptions"]>;
      const rollupOptions: RollupOptionsType | undefined = hasEntries
        ? {
            input: entries,
            output: createOctoberRollupOutput(entryOutputPath, cssOutputPath)
          }
        : undefined;

      const devServerOrigin = resolveConfiguredDevOrigin(env, userConfig, options.hostUrl);

      return {
        build: { rollupOptions },
        server: devServerOrigin ? { origin: devServerOrigin } : undefined
      } satisfies UserConfig;
    },

    configureServer(server) {
      if (!enabled) return;
      configureOctoberDevServer(server, devState, debug, log);
    },

    transform: createOctoberCssTransformHook(enabled, devState, debug, log),

    generateBundle(_opts, bundle) {
      const owners = collectAssetOwners(bundle);
      relocatePluginAssets({
        bundle,
        owners,
        projectRoot,
        containerDirsForOwner: pluginContainerDirs
      });
      rewriteCssUrlsInBundle(bundle);
    }
  };
}
