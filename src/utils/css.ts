import path from "node:path";
import type { OutputAsset, OutputBundle } from "rolldown";

/**
 * Rewrite url() references in emitted CSS assets to point at relocated assets.
 *
 * @param bundle Rollup output bundle
 */
export function rewriteCssUrlsInBundle(bundle: OutputBundle): void {
  const matchesHashedCandidate = (candidatePath: string, fileName: string): boolean => {
    if (candidatePath.endsWith(`/${fileName}`) || candidatePath === fileName) return true;
    const extIdx = fileName.lastIndexOf(".");
    if (extIdx <= 0) return false;
    const stem = fileName.slice(0, extIdx);
    const ext = fileName.slice(extIdx).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hashed = new RegExp(`/${escapedStem}-[a-zA-Z0-9_-]+${ext}$`);
    return hashed.test(candidatePath);
  };

  for (const [cssFileName, asset] of Object.entries(bundle)) {
    if (asset.type !== "asset") continue;
    if (!cssFileName.endsWith(".css")) continue;

    const cssPath = cssFileName.replace(/\\/g, "/");
    const cssDir = path.posix.dirname(cssPath);
    const text = typeof asset.source === "string" ? asset.source : Buffer.from((asset as OutputAsset).source as any).toString("utf8");

    const rewritten = text.replace(/url\(\s*([^)]+?)\s*\)/gi, (m, p1) => {
      const raw0 = (p1 as string).trim();
      const quote = raw0.startsWith("'") ? "'" : raw0.startsWith('"') ? `"` : "";
      const raw = raw0.replace(/^['"]|['"]$/g, "");
      if (/^(data:|https?:|\/\/)/i.test(raw)) return m;

      const [rawPath, suffix = ""] = raw.split(/([?#].*)/, 2);

      const findBySuffix = (suffix: string) =>
        Object.values(bundle).find(
          (a) => a.type === "asset" && a.fileName.replace(/\\/g, "/").endsWith(suffix)
        ) as OutputAsset | undefined;

      let targetOut: string | null = null;

      if (rawPath.startsWith("/")) {
        const abs = rawPath.replace(/^\//, "").replace(/\\/g, "/");
        const candidate = findBySuffix(abs);
        if (candidate) targetOut = candidate.fileName.replace(/\\/g, "/");
      } else {
        const srcNoQuery = rawPath.split(/[?#]/)[0];
        const baseOnly = srcNoQuery.replace(/\\/g, "/").split("/").pop() || srcNoQuery;

        const dirParts = cssDir.split("/");
        const isModuleCss = dirParts.length >= 2 && dirParts[0] === "modules";
        const modName = isModuleCss ? dirParts[1] : null;

        const fontsPath = isModuleCss ? `modules/${modName}/fonts/${baseOnly}` : `fonts/${baseOnly}`;
        const imagesPath = isModuleCss ? `modules/${modName}/images/${baseOnly}` : `images/${baseOnly}`;

        const candidates = Object.values(bundle)
          .filter((a) => a.type === "asset")
          .map((a) => a.fileName.replace(/\\/g, "/"));

        const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const fontsRx = new RegExp(`^${escape(cssDir)}/fonts/${escape(baseOnly)}$`);
        const imagesRx = new RegExp(`^${escape(cssDir)}/images/${escape(baseOnly)}$`);

        let hit = candidates.find((p) => matchesHashedCandidate(p, baseOnly));
        const preferFonts = candidates.find((p) => p.endsWith(`/${fontsPath}`)) || candidates.find((p) => fontsRx.test(p));
        const preferImages = candidates.find((p) => p.endsWith(`/${imagesPath}`)) || candidates.find((p) => imagesRx.test(p));
        targetOut = preferFonts || preferImages || hit || null;

        if (!targetOut && /^\.\.\//.test(rawPath)) {
          const guess = isModuleCss ? `modules/${modName}/images/${baseOnly}` : `images/${baseOnly}`;
          const candidate2 = candidates.find((p) => p.endsWith(`/${guess}`));
          if (candidate2) targetOut = candidate2;
        }
      }

      if (targetOut) {
        let rel = path.posix.relative(cssDir, targetOut);
        if (!rel.startsWith(".") && !rel.startsWith("/")) rel = `./${rel}`;
        return `url(${quote}${rel}${suffix}${quote})`;
      }

      return m;
    });

    if (rewritten !== text) (asset as OutputAsset).source = rewritten;
  }
}
