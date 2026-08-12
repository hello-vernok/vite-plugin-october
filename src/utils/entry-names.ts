/**
 * October internal entry tag prefix.
 */
export type OctoberEntryTag = "mod" | "fw" | "root";

/**
 * Parsed October Rollup entry or CSS asset base name.
 */
export interface ParsedOctoberEntryName {
  tag: OctoberEntryTag;
  entryName: string;
}

const OCTOBER_ENTRY_TAGS = new Set<OctoberEntryTag>(["mod", "fw", "root"]);

/**
 * Strip a trailing `.css` suffix from a Rollup asset base name.
 *
 * @param name Rollup entry or CSS asset base name
 * @returns Base name without a CSS extension
 */
function stripCssSuffix(name: string): string {
  return name.replace(/\.css$/i, "");
}

/**
 * Split an internal October entry name into segments.
 *
 * @param name Rollup entry or CSS asset base name without a CSS extension
 * @returns Segments and the delimiter used to join the middle segment
 */
function splitEntrySegments(name: string): { segments: string[]; middleJoiner: string } {
  if (name.includes(":")) {
    return { segments: name.split(":"), middleJoiner: ":" };
  }

  return { segments: name.split("_"), middleJoiner: "_" };
}

/**
 * Parse an internal October entry or CSS asset base name.
 *
 * Rolldown (Vite 8) sanitizes Rollup input keys by replacing `:` with `_`.
 * Module and formwidget folder names may themselves contain underscores, so the
 * middle segment is everything between the tag prefix and the trailing `entrypoint`.
 *
 * @param name Rollup entry or CSS asset base name
 * @returns Parsed descriptor or null
 */
export function parseOctoberEntryName(name: string): ParsedOctoberEntryName | null {
  const base = stripCssSuffix(name);
  const { segments, middleJoiner } = splitEntrySegments(base);

  if (segments.length < 2) {
    return null;
  }

  const tag = segments[0] as OctoberEntryTag;
  if (!OCTOBER_ENTRY_TAGS.has(tag)) {
    return null;
  }

  if (segments[segments.length - 1] !== "entrypoint") {
    return null;
  }

  const entryName = segments.slice(1, -1).join(middleJoiner);

  if (tag === "root") {
    if (entryName !== "") {
      return null;
    }

    return { tag, entryName: "" };
  }

  if (entryName === "") {
    return null;
  }

  return { tag, entryName };
}
