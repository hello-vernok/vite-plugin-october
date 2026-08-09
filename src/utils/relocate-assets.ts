import path from "node:path";
import fg from "fast-glob";
import type { OutputAsset, OutputBundle } from "rolldown";
import { FONT_EXTENSIONS, IMAGE_EXTENSIONS } from "./constants.js";

export interface RelocateCommonOpts {
  bundle: OutputBundle;
  owners: Map<string, string>;
  projectRoot: string | null;
}

export interface AssetContainerDirs {
  fonts: string;
  images: string;
}

export interface RelocateAssetsOpts extends RelocateCommonOpts {
  containerDirsForOwner: (owner: string) => AssetContainerDirs;
  imageExtensions?: Set<string>;
  /**
   * When true, orphaned root-level images fall back to assets/images/.
   * Theme builds use this; plugin builds do not.
   */
  fallbackRootImages?: boolean;
}

/**
 * Strip a Vite/Rollup content hash from an emitted asset basename.
 *
 * @param fileName Emitted asset file name
 * @returns Unhashed basename or null when no hash suffix is present
 */
function unhashedBasename(fileName: string): string | null {
  const base = path.posix.basename(fileName);
  const m = base.match(/^(.*)-[A-Za-z0-9_-]{6,}(\.[^.]+)$/);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

/**
 * Resolve the owning entry chunk for an emitted asset.
 *
 * @param fileName Emitted asset file name
 * @param owners Asset owner map from collectAssetOwners
 * @returns Owner chunk name or null
 */
function resolveAssetOwner(fileName: string, owners: Map<string, string>): string | null {
  let owner = owners.get(fileName) ?? owners.get(path.posix.basename(fileName)) ?? null;
  if (!owner) {
    const plain = unhashedBasename(fileName);
    if (plain) owner = owners.get(plain) ?? null;
  }
  return owner;
}

/**
 * Relocate orphaned module images by locating their source under resources/modules.
 *
 * @param projectRoot Plugin or theme root directory
 * @param fileName Emitted asset file name
 * @param outputBase Output basename to preserve
 * @returns Relocated output path or null
 */
function relocateOrphanedModuleImage(
  projectRoot: string,
  fileName: string,
  outputBase: string
): string | null {
  const matchBase = unhashedBasename(fileName) || outputBase;
  const matches = fg.sync([
    path.join(projectRoot, "resources", "modules", "*", "**", matchBase).replace(/\\/g, "/")
  ], { onlyFiles: true, dot: false });

  if (matches.length === 0) {
    return null;
  }

  const modPath = matches[0].replace(/\\/g, "/");
  const parts = modPath.split("/");
  const idx = parts.indexOf("modules");
  if (idx === -1 || !parts[idx + 1]) {
    return null;
  }

  return `modules/${parts[idx + 1]}/images/${outputBase}`;
}

/**
 * Relocate font and image assets into their October output folders.
 *
 * @param opts Relocation options
 */
export function relocateAssets(opts: RelocateAssetsOpts): void {
  const {
    bundle,
    owners,
    projectRoot,
    containerDirsForOwner,
    fallbackRootImages = false,
    imageExtensions = IMAGE_EXTENSIONS
  } = opts;

  for (const [fileName, asset] of Object.entries(bundle)) {
    if (asset.type !== "asset") continue;

    const ext = (fileName.split(".").pop() || "").toLowerCase();
    const owner = resolveAssetOwner(fileName, owners);

    if (!owner) {
      if (!projectRoot || !imageExtensions.has(ext)) {
        continue;
      }

      try {
        const outputBase = path.posix.basename(fileName);
        const relocated = relocateOrphanedModuleImage(projectRoot, fileName, outputBase);
        if (relocated) {
          (asset as OutputAsset).fileName = relocated;
          continue;
        }
        if (fallbackRootImages) {
          (asset as OutputAsset).fileName = `images/${outputBase}`;
        }
      } catch {
        // best-effort only
      }
      continue;
    }

    const dirs = containerDirsForOwner(owner);
    const base = path.posix.basename(fileName);
    if (FONT_EXTENSIONS.has(ext)) {
      (asset as OutputAsset).fileName = `${dirs.fonts}/${base}`.replace(/\\/g, "/");
    } else if (imageExtensions.has(ext)) {
      (asset as OutputAsset).fileName = `${dirs.images}/${base}`.replace(/\\/g, "/");
    }
  }
}

/**
 * Relocate assets for the plugin variant using its container mapping.
 *
 * @param opts Relocation options
 */
export function relocatePluginAssets(opts: RelocateCommonOpts & {
  containerDirsForOwner: (owner: string) => AssetContainerDirs;
  imageExtensions?: Set<string>;
}): void {
  relocateAssets({
    ...opts,
    fallbackRootImages: false
  });
}

/**
 * Relocate assets for the theme variant.
 *
 * @param opts Relocation options
 */
export function relocateThemeAssets(opts: RelocateCommonOpts & {
  containerDirsForOwner: (owner: string) => AssetContainerDirs;
}): void {
  relocateAssets({
    ...opts,
    fallbackRootImages: true
  });
}
