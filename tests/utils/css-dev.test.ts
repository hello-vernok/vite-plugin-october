import { describe, it, expect } from "vitest";
import { rewriteAbsoluteCssUrlsInDev } from "../../src/utils/css-dev.ts";

describe("utils/css-dev.ts - rewriteAbsoluteCssUrlsInDev", () => {
  it("rewrites /resources|/plugins|/modules|/themes absolute urls to include vite origin", () => {
    const input =
      ".a{background:url('/resources/images/svg-check-circle.svg')} .b{src:url(\"/themes/x/entrypoint.css\")}";
    const out = rewriteAbsoluteCssUrlsInDev(input, "http://localhost:5174/");
    expect(out).not.toContain("url('/resources/images/svg-check-circle.svg')");
    expect(out).toContain("url('http://localhost:5174/resources/images/svg-check-circle.svg')");
    expect(out).toContain('url("http://localhost:5174/themes/x/entrypoint.css")');
  });

  it("is tolerant to URL casing and whitespace", () => {
    const input = `.a{background:URL( "/resources/images/a.png" )}`;
    const out = rewriteAbsoluteCssUrlsInDev(input, "http://localhost:5174");
    // We don't preserve original spacing/casing exactly; just assert rewrite happened.
    expect(out).toContain("http://localhost:5174/resources/images/a.png");
  });

  it("keeps data: and http(s): urls untouched", () => {
    const input =
      ".a{background:url(data:image/png;base64,xyz)} .b{background:url('https://cdn.example.com/a.png')} .c{background:url('//cdn.example.com/b.png')}";
    const out = rewriteAbsoluteCssUrlsInDev(input, "http://localhost:5174");
    expect(out).toContain("data:image/png;base64,xyz");
    expect(out).toContain("https://cdn.example.com/a.png");
    expect(out).toContain("//cdn.example.com/b.png");
  });

  it("preserves query/hash suffix when rewriting", () => {
    const input = ".a{mask-image:url('/resources/images/a.svg?v=1#icon')}";
    const out = rewriteAbsoluteCssUrlsInDev(input, "http://localhost:5174");
    expect(out).toContain("http://localhost:5174/resources/images/a.svg?v=1#icon");
  });

  it("returns code unchanged when vite origin is unknown", () => {
    const input = ".a{background:url('/resources/images/a.png')}";
    const out = rewriteAbsoluteCssUrlsInDev(input, null);
    expect(out).toBe(input);
  });
});

