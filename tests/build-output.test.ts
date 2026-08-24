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

  it('writes plugin shared chunks under assets/modules/_shared', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-build-plugin-shared-'));
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', 'alpha'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', 'beta'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'modules', 'shared.ts'), "export const value = 'shared';");
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'modules', 'alpha', 'entrypoint.ts'),
      "import { value } from '../shared.ts'; console.log(value);"
    );
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'modules', 'beta', 'entrypoint.ts'),
      "import { value } from '../shared.ts'; console.log(value);"
    );

    await build({
      ...definePluginConfig(),
      root: tempRoot,
      configFile: false,
      logLevel: 'silent'
    });

    const sharedOutputs = await fg('assets/modules/_shared/*.js', {
      cwd: tempRoot,
      onlyFiles: true
    });

    expect(sharedOutputs.length).toBeGreaterThan(0);

    const manifest = JSON.parse(
      await fs.readFile(path.join(tempRoot, 'assets', '.vite', 'manifest.json'), 'utf8')
    ) as Record<string, { imports?: string[]; file?: string }>;

    const alphaEntry = manifest['resources/modules/alpha/entrypoint.ts'];
    expect(alphaEntry?.imports?.length).toBeGreaterThan(0);
    expect(alphaEntry?.imports?.some((key) => manifest[key]?.file?.startsWith('modules/_shared/'))).toBe(true);
  });

  it('writes theme root-involved shared chunks under assets/js/_shared', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-build-theme-root-shared-'));
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', 'blog'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'shared.ts'), "export const value = 'shared';");
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'entrypoint.ts'),
      "import { value } from './shared.ts'; console.log(value);"
    );
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'modules', 'blog', 'entrypoint.ts'),
      "import { value } from '../../shared.ts'; console.log(value);"
    );

    await build({
      ...defineThemeConfig(),
      root: tempRoot,
      configFile: false,
      logLevel: 'silent'
    });

    const sharedOutputs = await fg('assets/js/_shared/*.js', {
      cwd: tempRoot,
      onlyFiles: true
    });

    expect(sharedOutputs.length).toBeGreaterThan(0);
  });

  it('writes theme module-only shared chunks under assets/modules/_shared', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oct-vite-build-theme-mod-shared-'));
    await fs.mkdir(path.join(tempRoot, 'resources'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', 'alpha'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, 'resources', 'modules', 'beta'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'resources', 'entrypoint.ts'), "console.log('theme root');");
    await fs.writeFile(path.join(tempRoot, 'resources', 'modules', 'shared.ts'), "export const value = 'shared';");
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'modules', 'alpha', 'entrypoint.ts'),
      "import { value } from '../shared.ts'; console.log(value);"
    );
    await fs.writeFile(
      path.join(tempRoot, 'resources', 'modules', 'beta', 'entrypoint.ts'),
      "import { value } from '../shared.ts'; console.log(value);"
    );

    await build({
      ...defineThemeConfig(),
      root: tempRoot,
      configFile: false,
      logLevel: 'silent'
    });

    const sharedOutputs = await fg('assets/modules/_shared/*.js', {
      cwd: tempRoot,
      onlyFiles: true
    });

    expect(sharedOutputs.length).toBeGreaterThan(0);
    expect(await fg('assets/js/_shared/*.js', { cwd: tempRoot, onlyFiles: true })).toHaveLength(0);
  });
});
