import path from "node:path";
import type { OutputBundle, OutputChunk } from "rolldown";
import { JS_SHARED_CHUNK_DIR, MODULES_SHARED_CHUNK_DIR } from "./constants.js";
import { parseOctoberEntryName } from "./entry-names.js";

/**
 * Whether a Rollup chunk name represents the theme root entrypoint.
 *
 * @param name Rollup chunk name (colon or underscore form)
 * @return {boolean}
 */
function isThemeRootEntryName(name: string): boolean {
  const parsed = parseOctoberEntryName(name);

  return parsed?.tag === "root";
}

/**
 * Whether a bundle chunk is a non-entry JavaScript chunk.
 *
 * @param chunk Rollup output chunk
 * @return {boolean}
 */
function isSharedJsChunk(chunk: OutputChunk): boolean {
  return chunk.type === "chunk" && !chunk.isEntry && chunk.fileName.endsWith(".js");
}

/**
 * Collect chunk keys reachable from a starting chunk via import edges.
 *
 * @param bundle Rollup output bundle
 * @param startKey Starting chunk key
 * @return {Set<string>}
 */
function reachableChunkKeys(bundle: OutputBundle, startKey: string): Set<string> {
  const visited = new Set<string>();
  const queue = [startKey];

  while (queue.length > 0) {
    const key = queue.shift();

    if (!key || visited.has(key)) {
      continue;
    }

    visited.add(key);

    const chunk = bundle[key];

    if (!chunk || chunk.type !== "chunk") {
      continue;
    }

    for (const imported of chunk.imports ?? []) {
      if (!visited.has(imported)) {
        queue.push(imported);
      }
    }
  }

  return visited;
}

/**
 * Find theme root entry chunk keys in the bundle.
 *
 * @param bundle Rollup output bundle
 * @return {string[]}
 */
function themeRootEntryKeys(bundle: OutputBundle): string[] {
  const keys: string[] = [];

  for (const [key, item] of Object.entries(bundle)) {
    if (item.type !== "chunk" || !item.isEntry) {
      continue;
    }

    const name = item.name ?? key;

    if (isThemeRootEntryName(name)) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Chunks imported (directly or transitively) from theme root entrypoints.
 *
 * @param bundle Rollup output bundle
 * @return {Set<string>}
 */
function chunksReachableFromThemeRoot(bundle: OutputBundle): Set<string> {
  const reachable = new Set<string>();

  for (const rootKey of themeRootEntryKeys(bundle)) {
    for (const key of reachableChunkKeys(bundle, rootKey)) {
      reachable.add(key);
    }
  }

  return reachable;
}

/**
 * Move theme shared JS chunks to js/_shared when the theme root entry imports them.
 *
 * @param bundle Rollup output bundle
 * @return {void}
 */
export function relocateThemeSharedChunks(bundle: OutputBundle): void {
  const fromRoot = chunksReachableFromThemeRoot(bundle);

  for (const [key, item] of Object.entries(bundle)) {
    if (!isSharedJsChunk(item as OutputChunk)) {
      continue;
    }

    const chunk = item as OutputChunk;
    const baseName = path.posix.basename(chunk.fileName);
    const targetDir = fromRoot.has(key) ? JS_SHARED_CHUNK_DIR : MODULES_SHARED_CHUNK_DIR;

    chunk.fileName = `${targetDir}/${baseName}`;
  }
}
