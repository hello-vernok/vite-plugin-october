import type { UserConfig } from "vite";
import { octoberTheme } from "./october-theme.js";
import { defineOctoberConfig } from "./utils/define-october-config.js";

/**
 * Zero-config Vite helper for OctoberCMS theme repositories.
 *
 * @param overrides Optional Vite config overrides
 * @returns Vite config with October theme defaults applied
 */
export function defineThemeConfig(overrides: UserConfig = {}): UserConfig {
  return defineOctoberConfig(overrides, () => octoberTheme(), "vernok-october-theme");
}
