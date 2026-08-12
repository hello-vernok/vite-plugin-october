import fg from "fast-glob";
import path from "node:path";
import type { Plugin, UserConfig, ConfigEnv } from "vite";
import { resolveConfiguredDevOrigin } from "./utils/dev.js";
import { configureOctoberDevServer, createOctoberCssTransformHook, createOctoberDevState } from "./utils/dev-hooks.js";
import { rewriteCssUrlsInBundle } from "./utils/css.js";
import { collectAssetOwners } from "./utils/bundle-owners.js";
import { relocateThemeAssets, type AssetContainerDirs } from "./utils/relocate-assets.js";
import { parseOctoberEntryName } from "./utils/entry-names.js";
import { createOctoberRollupOutput } from "./utils/rollup-output.js";

/**
 * Theme plugin options.
 */
export interface OctoberThemeOptions {
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
 * Discover OctoberCMS Theme entry files.
 *
 * @param rootDir Theme root directory
 * @returns Rollup input map keyed by internal entry names
 */
export function discoverThemeEntries(rootDir: string): Record<string, string> {
  const globs = [
    path.join(rootDir, "resources", "entrypoint.{js,ts}"),
    path.join(rootDir, "resources", "modules", "*", "entrypoint.{js,ts}")
  ].map((g) => g.replaceAll("\\", "/"));

  const files = fg.sync(globs, { dot: false, onlyFiles: true });
  const entries: Record<string, string> = {};

  for (const file of files) {
    const posixFile = file.replaceAll("\\", "/");
    const parts = posixFile.split("/");
    const idxRes = parts.indexOf("resources");
    if (idxRes === -1) continue;

    const next = parts[idxRes + 1];
    if (next === "entrypoint.ts" || next === "entrypoint.js") {
      entries["root:entrypoint"] = path.resolve(file);
    }
    if (next === "modules") {
      entries[`mod:${parts[idxRes + 2]}:entrypoint`] = path.resolve(file);
    }
  }

  return entries;
}

/**
 * Resolve theme asset container folders for an entry owner.
 *
 * @param owner Rollup entry chunk name
 * @returns Font and image output directories
 */
function themeContainerDirs(owner: string): AssetContainerDirs {
  const parsed = parseOctoberEntryName(owner);
  if (parsed?.tag === "mod") {
    return {
      fonts: `modules/${parsed.entryName}/fonts`,
      images: `modules/${parsed.entryName}/images`
    };
  }

  return { fonts: "fonts", images: "images" };
}

/**
 * Resolve theme JS output path for a Rollup entry name.
 *
 * @param name Rollup entry chunk name
 * @returns Output path template
 */
function entryOutputPath(name: string): string {
  const parsed = parseOctoberEntryName(name);
  if (parsed?.tag === "root") return "js/entrypoint-[hash].js";
  if (parsed?.tag === "mod") return `modules/${parsed.entryName}/entrypoint-[hash].js`;
  return `js/${name}-[hash].js`;
}

/**
 * Resolve theme CSS output path for a Rollup asset base name.
 *
 * @param name Rollup CSS asset base name
 * @returns Output path template
 */
function cssOutputPath(name: string): string {
  const parsed = parseOctoberEntryName(name);
  if (parsed?.tag === "root") return "css/entrypoint-[hash].css";
  if (parsed?.tag === "mod") return `modules/${parsed.entryName}/entrypoint-[hash].css`;
  return `css/${name}-[hash].css`;
}

/**
 * Vite plugin that auto-discovers OctoberCMS Theme entries and configures Rollup.
 *
 * @param options Plugin options
 * @returns Configured Vite plugin
 */
export function octoberTheme(options: OctoberThemeOptions = {}): Plugin {
  const enabled = options.enabled ?? true;
  const debug = options.debug ?? false;
  const log = (...args: unknown[]) => {
    if (debug) console.log("[vernok-october-theme]", ...args);
  };

  let projectRoot: string | null = null;
  const devState = createOctoberDevState();

  return {
    name: "vernok-october-theme",
    enforce: "pre",

    config(userConfig: UserConfig, env: ConfigEnv) {
      if (!enabled) return;

      const rootDir = userConfig.root ? path.resolve(userConfig.root) : process.cwd();
      projectRoot = rootDir;
      const entries = discoverThemeEntries(rootDir);
      const hasEntries = Object.keys(entries).length > 0;
      debug && log("entries", entries);

      if (!hasEntries) {
        const msg = [
          "No October theme entrypoints were found.",
          `Searched under: ${path.join(rootDir, "resources")}`,
          "Expected at least one of:",
          " - resources/entrypoint.{ts,js}",
          " - resources/modules/<module>/entrypoint.{ts,js}",
          "\nCreate one of the files above and run the build again.",
          "If you need to diagnose discovery, enable debug: octoberTheme({ debug: true })"
        ].join("\n");
        throw new Error(`[vernok-october-theme] ${msg}`);
      }

      type RollupOptionsType = NonNullable<NonNullable<UserConfig["build"]>["rollupOptions"]>;
      const rollupOptions: RollupOptionsType = {
        input: entries,
        output: createOctoberRollupOutput(entryOutputPath, cssOutputPath)
      };

      const devServerOrigin = resolveConfiguredDevOrigin(env, userConfig, options.hostUrl);

      return {
        build: { rollupOptions },
        appType: "custom",
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
      relocateThemeAssets({
        bundle,
        owners,
        projectRoot,
        containerDirsForOwner: themeContainerDirs
      });
      rewriteCssUrlsInBundle(bundle);
    }
  };
}
