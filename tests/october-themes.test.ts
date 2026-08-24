import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverThemeEntries, octoberTheme } from '../src/october-theme.ts';
import { defineThemeConfig } from '../src/index.ts';
import { callConfigHook } from './utils/object-hook.ts';

async function rimraf(dir: string) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
}

async function makeTempTheme() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-theme-'));
  // root entrypoint
  await fs.mkdir(path.join(tmp, 'resources'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'resources', 'entrypoint.ts'), '// root');
  // module entrypoint
  await fs.mkdir(path.join(tmp, 'resources', 'modules', 'blog'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'resources', 'modules', 'blog', 'entrypoint.js'), '// blog');
  // Create a non-entry JS file that should NOT be auto-discovered
  const jsDir = path.join(tmp, 'resources', 'js');
  await fs.mkdir(jsDir, { recursive: true });
  await fs.writeFile(path.join(jsDir, 'backend.js'), '// should be ignored by discovery');
  return tmp;
}

describe('october-theme plugin', () => {
  let tempRoot: string;

  beforeAll(async () => {
    tempRoot = await makeTempTheme();
  });

  afterAll(async () => {
    await rimraf(tempRoot);
  });

  it('discovers entries from theme root and modules entrypoints', async () => {
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', '_shared'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'modules', '_shared', 'entrypoint.ts'), '// reserved');

    const entries = discoverThemeEntries(tempRoot);
    expect(Object.keys(entries).sort()).toEqual(['mod:blog:entrypoint', 'root:entrypoint']);
    expect(entries['root:entrypoint'].replaceAll('\\','/')).toMatch(/\/resources\/entrypoint\.ts$/);
    expect(entries['mod:blog:entrypoint'].replaceAll('\\','/')).toMatch(/\/resources\/modules\/blog\/entrypoint\.js$/);
  });

  it('does NOT discover arbitrary files like resources/js/backend.js', async () => {
    const entries = discoverThemeEntries(tempRoot);
    expect(Object.keys(entries)).not.toContain('backend');
    const values = Object.values(entries).map(v => v.replaceAll('\\','/'));
    expect(values.find(v => /\/resources\/js\/backend\.js$/.test(v))).toBeUndefined();
  });

  it('produces correct JS and CSS output paths', () => {
    const plugin = octoberTheme();
    const cfg = callConfigHook(plugin as any, { root: tempRoot }, { mode: 'development', command: 'build' } as any);
    const rollupOptions = (cfg as any)?.build?.rollupOptions;
    expect(rollupOptions).toBeTruthy();
    const entryFileNames = rollupOptions.output.entryFileNames as (info: { name: string }) => string;
    const assetFileNames = rollupOptions.output.assetFileNames as (info: { name?: string }) => string;
    const chunkFileNames = rollupOptions.output.chunkFileNames as string;

    expect(chunkFileNames).toBe('modules/_shared/[name]-[hash].js');

    expect(entryFileNames({ name: 'root:entrypoint' })).toBe('js/entrypoint-[hash].js');
    expect(assetFileNames({ name: 'root:entrypoint.css' })).toBe('css/entrypoint-[hash].css');
    expect(entryFileNames({ name: 'mod:blog:entrypoint' })).toBe('modules/blog/entrypoint-[hash].js');
    expect(entryFileNames({ name: 'mod_content_example_entrypoint' })).toBe(
      'modules/content_example/entrypoint-[hash].js'
    );
    expect(assetFileNames({ name: 'mod:blog:entrypoint.css' })).toBe('modules/blog/entrypoint-[hash].css');
    expect(assetFileNames({ name: 'mod_content_example_entrypoint.css' })).toBe(
      'modules/content_example/entrypoint-[hash].css'
    );
    expect(entryFileNames({ name: 'root_entrypoint' })).toBe('js/entrypoint-[hash].js');
    expect(assetFileNames({ name: 'root_entrypoint.css' })).toBe('css/entrypoint-[hash].css');
  });

  it('relocates module assets for Rolldown-sanitized theme module names with underscores', () => {
    const plugin = octoberTheme();
    const bundle: any = {
      'mod:content_example:entrypoint.js': {
        type: 'chunk',
        name: 'mod_content_example_entrypoint',
        isEntry: true,
        viteMetadata: { importedAssets: new Set(['cover.jpg']) }
      },
      'cover.jpg': { type: 'asset', name: 'cover.jpg', fileName: 'cover.jpg', source: new Uint8Array([0]) }
    };

    (plugin as any).generateBundle?.({}, bundle);

    expect(bundle['cover.jpg'].fileName).toBe('modules/content_example/images/cover.jpg');
  });

  it('does not force server.origin during vite serve when hostUrl/VITE_HOST_URL are missing', () => {
    const prev = process.env.VITE_HOST_URL;
    delete process.env.VITE_HOST_URL;
    try {
      const plugin = octoberTheme();
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
    const plugin = octoberTheme({ hostUrl: 'http://host.docker.internal:8124' });
    const cfg = callConfigHook(
      plugin as any,
      { root: tempRoot } as any,
      { mode: 'development', command: 'serve' } as any
    );
    expect((cfg as any).server?.origin).toBe('http://host.docker.internal:8124');
  });

  it('remaps font and image assets into fonts/ and images/ (root) and modules/[module]/… for modules', () => {
    const plugin = octoberTheme();
    const bundle: any = {
      'root:entrypoint.js': {
        type: 'chunk',
        name: 'root:entrypoint',
        isEntry: true,
        viteMetadata: {
          assets: new Set(['font.woff2', 'theme.svg']),
          importedAssets: new Set(['photo.png'])
        }
      },
      'mod:blog:entrypoint.js': {
        type: 'chunk',
        name: 'mod:blog:entrypoint',
        isEntry: true,
        viteMetadata: {
          assets: new Set(['blog.ttf']),
          importedAssets: new Set(['cover.jpg'])
        }
      },
      'font.woff2': { type: 'asset', name: 'font.woff2', fileName: 'font.woff2', source: new Uint8Array([0]) },
      'photo.png': { type: 'asset', name: 'photo.png', fileName: 'photo.png', source: new Uint8Array([0]) },
      'blog.ttf': { type: 'asset', name: 'blog.ttf', fileName: 'blog.ttf', source: new Uint8Array([0]) },
      'cover.jpg': { type: 'asset', name: 'cover.jpg', fileName: 'cover.jpg', source: new Uint8Array([0]) },
      'theme.svg': { type: 'asset', name: 'theme.svg', fileName: 'theme.svg', source: new Uint8Array([0]) },
    };
    (plugin as any).generateBundle?.({}, bundle);
    expect(bundle['font.woff2'].fileName).toBe('fonts/font.woff2');
    expect(bundle['photo.png'].fileName).toBe('images/photo.png');
    expect(bundle['blog.ttf'].fileName).toBe('modules/blog/fonts/blog.ttf');
    expect(bundle['cover.jpg'].fileName).toBe('modules/blog/images/cover.jpg');
    expect(bundle['theme.svg'].fileName).toBe('images/theme.svg');
  });

  it('enables manifest, relative CSS urls and scss quietDeps by default in defineThemeConfig()', () => {
    const cfg = defineThemeConfig();
    expect(cfg.build?.manifest).toBe(true);
    expect((cfg.css?.preprocessorOptions as any)?.scss?.quietDeps).toBe(true);
    const fn = (cfg as any)?.experimental?.renderBuiltUrl as undefined | ((filename: string, ctx: any) => any);
    expect(typeof fn).toBe('function');
    const cssResult = fn!('fonts/font.woff2', { hostType: 'css' });
    expect(cssResult).toEqual({ relative: true });
    const jsResult = fn!('fonts/font.woff2', { hostType: 'js' });
    expect(jsResult).toBeUndefined();
  });
});