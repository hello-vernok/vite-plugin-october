/**
 * Utility helper to call a Vite plugin's config hook in tests.
 */

/**
 * Call a plugin's `config` hook and return the produced config (sync only).
 * @param plugin Vite plugin instance
 * @param inline Inline user config passed to the hook
 * @param env Vite config env (mode/command)
 * @returns The config returned by the plugin's `config` hook, or the inline config
 */
export function callConfigHook<T extends object = any>(
  plugin: any,
  inline: T = {} as T,
  env: { mode: string; command: 'serve' | 'build' } = { mode: 'development', command: 'build' }
): T {
  const fn = typeof plugin?.config === 'function' ? plugin.config.bind(plugin) : null;
  if (!fn) return inline;
  const res = fn(inline, env);
  // For our tests we expect a synchronous partial config
  if (res && typeof (res as any).then === 'function') {
    throw new Error('callConfigHook received a Promise; tests expect a sync config hook');
  }
  return (res ?? inline) as T;
}
