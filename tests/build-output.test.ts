import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fg from 'fast-glob';
import { build } from 'vite';
import { definePluginConfig } from '../src/define-plugin-config.ts';
import { defineThemeConfig } from '../src/define-theme-config.ts';

async function rimraf(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

describe('vite build output paths', () => {
  let tempRoot: string;

  afterEach(async () => {
    if (tempRoot) {
      await rimraf(tempRoot);
    }
  });

  it('writes plugin module assets under modules/<name>/ for Rolldown-sanitized names', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-build-plugin-'));
    const moduleDir = path.join(tempRoot, 'resources', 'modules', 'content_example');
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.writeFile(path.join(moduleDir, 'entrypoint.ts'), "console.log('plugin module');");

    await build({
      ...definePluginConfig(),
      root: tempRoot,
      configFile: false,
      logLevel: 'silent'
    });

    const outputs = await fg('assets/modules/content_example/*', {
      cwd: tempRoot,
      onlyFiles: true
    });

    expect(outputs.some((file) => file.endsWith('.js'))).toBe(true);
    expect(outputs.some((file) => file.includes('mod_content_example_entrypoint'))).toBe(false);
  });

  it('writes theme module assets under modules/<name>/ for Rolldown-sanitized names', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-build-theme-'));
    await fs.mkdir(path.join(tempRoot, 'resources'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'entrypoint.ts'), "console.log('theme root');");

    const moduleDir = path.join(tempRoot, 'resources', 'modules', 'content_example');
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.writeFile(path.join(moduleDir, 'entrypoint.ts'), "console.log('theme module');");

    await build({
      ...defineThemeConfig(),
      root: tempRoot,
      configFile: false,
      logLevel: 'silent'
    });

    const outputs = await fg('assets/modules/content_example/*', {
      cwd: tempRoot,
      onlyFiles: true
    });

    expect(outputs.some((file) => file.endsWith('.js'))).toBe(true);
    expect(outputs.some((file) => file.includes('mod_content_example_entrypoint'))).toBe(false);
  });
});
