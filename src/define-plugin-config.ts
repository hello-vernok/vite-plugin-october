import type { UserConfig } from "vite";
import { octoberPlugin } from "./october-plugin.js";
import { defineOctoberConfig } from "./utils/define-october-config.js";

/**
 * Zero-config Vite helper for OctoberCMS plugin repositories.
 *
 * @param overrides Optional Vite config overrides
 * @returns Vite config with October plugin defaults applied
 */
export function definePluginConfig(overrides: UserConfig = {}): UserConfig {
  return defineOctoberConfig(overrides, () => octoberPlugin(), "vernok-october-plugin");
}
