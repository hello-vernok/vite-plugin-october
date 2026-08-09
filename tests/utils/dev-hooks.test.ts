import { describe, it, expect } from "vitest";
import { isCssLikeModuleId } from "../../src/utils/dev-hooks.ts";

describe("utils/dev-hooks.ts", () => {
  it("detects css-like module ids", () => {
    expect(isCssLikeModuleId("/app/resources/foo/main.scss")).toBe(true);
    expect(isCssLikeModuleId("/app/Component.vue?vue&type=style&lang.css")).toBe(true);
    expect(isCssLikeModuleId("/app/resources/foo/main.ts")).toBe(false);
  });
});
