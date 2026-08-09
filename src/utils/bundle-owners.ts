import type { OutputBundle } from "rolldown";

/**
 * Build a map of emitted asset owners (by entry chunk name).
 * Keys include both the full emitted path and its basename (without a query).
 *
 * @param bundle Rollup output bundle
 * @returns Asset owner map
 */
export function collectAssetOwners(bundle: OutputBundle): Map<string, string> {
  const owners = new Map<string, string>();
  for (const [, chunk] of Object.entries(bundle)) {
    if (chunk.type !== "chunk") continue;
    const c: any = chunk as any;
    const meta = c?.viteMetadata as { assets?: Set<string>; importedAssets?: Set<string> } | undefined;
    if (!meta) continue;
    const all = new Set<string>();
    if (meta.assets) for (const a of meta.assets) all.add(a);
    if (meta.importedAssets) for (const a of meta.importedAssets) all.add(a);
    const put = (key: string) => {
      if (!owners.has(key)) owners.set(key, chunk.name);
      const withoutQuery = key.split(/[?#]/)[0];
      const base = withoutQuery.replace(/\\/g, "/");
      const bn = base.split("/").pop() || base;
      if (!owners.has(bn)) owners.set(bn, chunk.name);
    };
    const isEntry = !!(c && (c.isEntry || c.facadeModuleId));
    if (isEntry) {
      for (const f of all) put(f);
    } else {
      for (const f of all) if (!owners.has(f)) put(f);
    }
  }
  return owners;
}
