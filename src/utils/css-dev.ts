/**
 * Dev-time CSS url() rewriting.
 *
 * In October scenarios PHP serves the HTML, and CSS may contain absolute URLs like
 * `url("/resources/images/x.svg")`. In the browser this resolves relative to the HTML page
 * origin (your PHP host), not the Vite dev server origin.
 *
 * We rewrite those absolute /resources|/themes|/modules|/plugins URLs to include the Vite
 * dev origin so the browser requests them from the correct dev server port.
 */
export function rewriteAbsoluteCssUrlsInDev(code: string, viteOrigin: string | null): string {
  if (!viteOrigin) return code;

  const origin = viteOrigin.replace(/\/$/, "");
  // Match CSS `url(...)` with any casing and whitespace.
  // We intentionally keep the inside loosely parsed and then validate the path prefix.
  return code.replace(/url\(\s*([^)]+?)\s*\)/gi, (m, p1) => {
    const raw0 = String(p1).trim();
    const quote = raw0.startsWith("'") ? "'" : raw0.startsWith('"') ? `"` : "";
    const raw = raw0.replace(/^['"]|['"]$/g, "");

    // Keep data: and absolute http(s) URLs untouched.
    if (/^(data:|https?:|\/\/)/i.test(raw)) return m;

    const [pathOnly, suffix = ""] = raw.split(/([?#].*)/, 2);

    const shouldRewrite =
      pathOnly.startsWith("/resources/") ||
      pathOnly.startsWith("/modules/") ||
      pathOnly.startsWith("/themes/") ||
      pathOnly.startsWith("/plugins/");

    if (!shouldRewrite) return m;

    return `url(${quote}${origin}${pathOnly}${suffix}${quote})`;
  });
}

