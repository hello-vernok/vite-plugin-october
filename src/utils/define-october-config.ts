import { defineConfig as viteDefineConfig, type Plugin, type UserConfig } from "vite";
import { mergeWith } from "lodash-es";

/**
 * Shared wrapper for October plugin/theme defineConfig helpers.
 */
export function defineOctoberConfig(
  overrides: UserConfig,
  pluginFactory: () => Plugin,
  pluginName: string
): UserConfig {
  const defaults: UserConfig = {
    server: {
      cors: true
    },
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true
        }
      }
    },
    build: {
      outDir: "assets",
      emptyOutDir: true,
      assetsDir: "",
      manifest: true,
      assetsInlineLimit: 0
    },
    experimental: {
      renderBuiltUrl(_filename, ctx) {
        if (ctx.hostType === "css") return { relative: true } as const;
        return undefined;
      }
    }
  };

  const merged = mergeWith({}, defaults, overrides, (objValue, srcValue) => {
    if (Array.isArray(objValue) && Array.isArray(srcValue)) return [...objValue, ...srcValue];
    return undefined;
  }) as UserConfig;

  const plugins = [...(merged.plugins ?? [])] as Plugin[];
  const alreadyHas = plugins.some((plugin) => plugin?.name === pluginName);
  if (!alreadyHas) {
    plugins.unshift(pluginFactory());
  }
  merged.plugins = plugins;

  return viteDefineConfig(merged);
}
