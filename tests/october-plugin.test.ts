import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { octoberPlugin, discoverPluginEntries } from '../src/october-plugin.ts';
import { definePluginConfig } from '../src/index.ts';
import { callConfigHook } from './utils/object-hook.ts';

async function makeTempProject() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-octplugin-'));
  // formwidget
  await fs.mkdir(path.join(tmp, 'resources', 'formwidgets', 'alpha'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'resources', 'formwidgets', 'alpha', 'entrypoint.ts'), '// fw');
  // module
  await fs.mkdir(path.join(tmp, 'resources', 'modules', 'cart'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'resources', 'modules', 'cart', 'entrypoint.ts'), '// module');
  return tmp;
}

async function rimraf(dir: string) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
}

describe('octoberPlugin (plugin repo)', () => {
  let tempRoot: string;

  beforeAll(async () => {
    tempRoot = await makeTempProject();
  });

  afterAll(async () => {
    await rimraf(tempRoot);
  });

  it('autodiscovers all entrypoint patterns', async () => {
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', '_shared'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'modules', '_shared', 'entrypoint.ts'), '// reserved');

    const entries = discoverPluginEntries(tempRoot);
    const keys = Object.keys(entries).sort();
    expect(keys).toEqual([
      'fw:alpha:entrypoint',
      'mod:cart:entrypoint'
    ]);
  });

  it('maps JS and CSS outputs exactly to assets tree', () => {
    const plugin = octoberPlugin();
    const cfg = callConfigHook(plugin as any, { root: tempRoot }, { mode: 'development', command: 'build' } as any);
    const roll = (cfg as any)?.build?.rollupOptions;
    expect(roll).toBeTruthy();
    const entryFileNames = roll.output.entryFileNames as (i: { name: string }) => string;
    const assetFileNames = roll.output.assetFileNames as (i: { name?: string }) => string;
    const chunkFileNames = roll.output.chunkFileNames as string;

    expect(chunkFileNames).toBe('modules/_shared/[name]-[hash].js');

    // JS
    expect(entryFileNames({ name: 'fw:alpha:entrypoint' })).toBe('formwidgets/alpha/entrypoint-[hash].js');
    expect(entryFileNames({ name: 'mod:cart:entrypoint' })).toBe('modules/cart/entrypoint-[hash].js');

    expect(entryFileNames({ name: 'fw_alpha_entrypoint' })).toBe('formwidgets/alpha/entrypoint-[hash].js');
    expect(entryFileNames({ name: 'mod_cart_entrypoint' })).toBe('modules/cart/entrypoint-[hash].js');
    expect(entryFileNames({ name: 'mod_content_example_entrypoint' })).toBe(
      'modules/content_example/entrypoint-[hash].js'
    );

    // CSS
    expect(assetFileNames({ name: 'fw:alpha:entrypoint.css' })).toBe('formwidgets/alpha/entrypoint-[hash].css');
    expect(assetFileNames({ name: 'mod:cart:entrypoint.css' })).toBe('modules/cart/entrypoint-[hash].css');
    expect(assetFileNames({ name: 'mod_cart_entrypoint.css' })).toBe('modules/cart/entrypoint-[hash].css');
    expect(assetFileNames({ name: 'mod_content_example_entrypoint.css' })).toBe(
      'modules/content_example/entrypoint-[hash].css'
    );
  });

  it('relocates module assets for Rolldown-sanitized entry names with underscores in the module folder', () => {
    const plugin = octoberPlugin();
    const bundle: any = {
      'mod:content_example:entrypoint.js': {
        type: 'chunk',
        name: 'mod_content_example_entrypoint',
        isEntry: true,
        viteMetadata: { assets: new Set(['icon.svg']) }
      },
      'icon.svg': { type: 'asset', name: 'icon.svg', fileName: 'icon.svg', source: new Uint8Array([0]) }
    };

    (plugin as any).generateBundle?.({}, bundle);

    expect(bundle['icon.svg'].fileName).toBe('modules/content_example/images/icon.svg');
  });

  it('does not force server.origin during vite serve when hostUrl/VITE_HOST_URL are missing', () => {
    const prev = process.env.VITE_HOST_URL;
    delete process.env.VITE_HOST_URL;
    try {
      const plugin = octoberPlugin();
      const cfg = callConfigHook(
        plugin as any,
        { root: tempRoot } as any,
        { mode: 'development', command: 'serve' } as any
      );
      expect((cfg as any).server).toBeUndefined();
      expect(JSON.stringify(cfg)).not.toContain("http://localhost:5173");
    } finally {
      if (prev !== undefined) process.env.VITE_HOST_URL = prev;
    }
  });

  it('forces server.origin when hostUrl is provided', () => {
    const plugin = octoberPlugin({ hostUrl: 'http://host.docker.internal:8123' });
    const cfg = callConfigHook(
      plugin as any,
      { root: tempRoot } as any,
      { mode: 'development', command: 'serve' } as any
    );
    expect((cfg as any).server?.origin).toBe('http://host.docker.internal:8123');
  });

  it('relocates fonts/images under the correct entry folders', () => {
    const plugin = octoberPlugin();
    const bundle: any = {
      'fw:alpha:entrypoint.js': { type: 'chunk', name: 'fw:alpha:entrypoint', isEntry: true, viteMetadata: { assets: new Set(['alpha.woff2', 'font.ttf']), importedAssets: new Set(['alpha.png', 'bg.jpg']) } },
      'mod:cart:entrypoint.js': { type: 'chunk', name: 'mod:cart:entrypoint', isEntry: true, viteMetadata: { assets: new Set(['cart.svg']) } },
      'alpha.woff2': { type: 'asset', name: 'alpha.woff2', fileName: 'alpha.woff2', source: new Uint8Array([0]) },
      'alpha.png': { type: 'asset', name: 'alpha.png', fileName: 'alpha.png', source: new Uint8Array([0]) },
      'font.ttf': { type: 'asset', name: 'font.ttf', fileName: 'font.ttf', source: new Uint8Array([0]) },
      'bg.jpg': { type: 'asset', name: 'bg.jpg', fileName: 'bg.jpg', source: new Uint8Array([0]) },
      'cart.svg': { type: 'asset', name: 'cart.svg', fileName: 'cart.svg', source: new Uint8Array([0]) },
    };

    (plugin as any).generateBundle?.({}, bundle);

    expect(bundle['alpha.woff2'].fileName).toBe('formwidgets/alpha/fonts/alpha.woff2');
    expect(bundle['alpha.png'].fileName).toBe('formwidgets/alpha/images/alpha.png');
    expect(bundle['font.ttf'].fileName).toBe('formwidgets/alpha/fonts/font.ttf');
    expect(bundle['bg.jpg'].fileName).toBe('formwidgets/alpha/images/bg.jpg');
    // SVG should now be classified under images
    expect(bundle['cart.svg'].fileName).toBe('modules/cart/images/cart.svg');
  });

  it('rewrites absolute CSS urls to ./fonts and ./images relative to widget root css', () => {
    const plugin = octoberPlugin();

    const cssName = 'formwidgets/alpha/entrypoint.css';
    const bundle: any = {
      'fw:alpha:entrypoint.js': {
        type: 'chunk',
        name: 'fw:alpha:entrypoint',
        isEntry: true,
        viteMetadata: {
          importedAssets: new Set(['fa-solid-900.ttf', 'photo.png'])
        }
      },
      [cssName]: {
        type: 'asset',
        name: 'fw:alpha:entrypoint.css',
        fileName: cssName,
        source: "@font-face{src:url('/fa-solid-900.ttf')} .bg{background-image:url('/photo.png')}"
      },
      'fa-solid-900.ttf': { type: 'asset', name: 'fa-solid-900.ttf', fileName: 'fa-solid-900.ttf', source: new Uint8Array([0]) },
      'photo.png': { type: 'asset', name: 'photo.png', fileName: 'photo.png', source: new Uint8Array([0]) }
    };

    (plugin as any).generateBundle?.({}, bundle);

    // After remap pass, assets should be relocated under widget folders
    expect(bundle['fa-solid-900.ttf'].fileName).toBe('formwidgets/alpha/fonts/fa-solid-900.ttf');
    expect(bundle['photo.png'].fileName).toBe('formwidgets/alpha/images/photo.png');

    // CSS should have its URLs rewritten with './' prefix from widget root css path
    const cssOut = String(bundle[cssName].source);
    expect(cssOut).toContain("url('./fonts/fa-solid-900.ttf')");
    expect(cssOut).toContain("url('./images/photo.png')");
  });

  it('enables manifest, relative CSS urls and scss quietDeps by default in definePluginConfig()', () => {
    const cfg = definePluginConfig();
    expect(cfg.build?.manifest).toBe(true);
    expect((cfg.css?.preprocessorOptions as any)?.scss?.quietDeps).toBe(true);
    const fn = (cfg as any)?.experimental?.renderBuiltUrl as undefined | ((filename: string, ctx: any) => any);
    expect(typeof fn).toBe('function');
    const cssResult = fn!('fonts/font.woff2', { hostType: 'css' });
    expect(cssResult).toEqual({ relative: true });
    const jsResult = fn!('fonts/font.woff2', { hostType: 'js' });
    expect(jsResult).toBeUndefined();
  });

  it('definePluginConfig registers only one october plugin when overrides already include one', () => {
    const custom = octoberPlugin({ debug: true });
    const cfg = definePluginConfig({ plugins: [custom] });
    const plugins = (cfg.plugins ?? []) as Array<{ name?: string }>;
    const octoberPlugins = plugins.filter((plugin) => plugin?.name === 'vernok-october-plugin');
    expect(octoberPlugins).toHaveLength(1);
  });
});
