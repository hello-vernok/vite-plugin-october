import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OutputBundle } from 'rolldown';
import { relocatePluginAssets, relocateThemeAssets } from '../../src/utils/relocate-assets.ts';

function asset(fileName: string) {
  return { type: 'asset', name: fileName, fileName, source: new Uint8Array([0]) } as any;
}

function chunk(name: string) {
  return { type: 'chunk', name, isEntry: true, viteMetadata: { assets: new Set<string>(), importedAssets: new Set<string>() } } as any;
}

describe('utils/relocate-assets.ts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('relocatePluginAssets moves fonts/images under container dirs for owner', () => {
    const bundle: OutputBundle = {
      'fw:alpha:entrypoint.js': chunk('fw:alpha:entrypoint'),
      'alpha.woff2': asset('alpha.woff2'),
      'photo.png': asset('photo.png'),
      'unknown.txt': asset('unknown.txt')
    } as any;

    const owners = new Map<string, string>([
      ['alpha.woff2', 'fw:alpha:entrypoint'],
      ['photo.png', 'fw:alpha:entrypoint']
    ]);

    relocatePluginAssets({
      bundle,
      owners,
      projectRoot: null,
      containerDirsForOwner: () => ({ fonts: 'formwidgets/alpha/fonts', images: 'formwidgets/alpha/images' })
    });

    expect((bundle['alpha.woff2'] as any).fileName).toBe('formwidgets/alpha/fonts/alpha.woff2');
    expect((bundle['photo.png'] as any).fileName).toBe('formwidgets/alpha/images/photo.png');
    expect((bundle['unknown.txt'] as any).fileName).toBe('unknown.txt');
  });

  it('relocateThemeAssets assigns module images when owner unknown but projectRoot provided (via fast-glob)', async () => {
    // Mock fast-glob default export with sync method
    vi.doMock('fast-glob', () => ({
      default: {
        sync: () => ['/project/resources/modules/cart/assets/unowned.png']
      }
    }), { virtual: true });

    const { relocateThemeAssets: relocateThemeAssetsReloaded } = await import('../../src/utils/relocate-assets.ts');

    const bundle: OutputBundle = {
      'unowned.png': asset('unowned.png')
    } as any;

    const owners = new Map<string, string>();
    relocateThemeAssetsReloaded({
      bundle,
      owners,
      projectRoot: '/project',
      containerDirsForOwner: () => ({ fonts: 'fonts', images: 'images' })
    });

    expect((bundle['unowned.png'] as any).fileName).toBe('modules/cart/images/unowned.png');
  });

  it('relocatePluginAssets maps hashed basename back to owner', () => {
    const bundle: OutputBundle = {
      'cms-logo-BM80Y3XF.png': asset('cms-logo-BM80Y3XF.png')
    } as any;

    const owners = new Map<string, string>([
      ['cms-logo.png', 'mod:backend:entrypoint']
    ]);

    relocatePluginAssets({
      bundle,
      owners,
      projectRoot: null,
      containerDirsForOwner: (owner) => owner === 'mod:backend:entrypoint'
        ? { fonts: 'modules/backend/fonts', images: 'modules/backend/images' }
        : { fonts: 'fonts', images: 'images' }
    });

    expect((bundle['cms-logo-BM80Y3XF.png'] as any).fileName)
      .toBe('modules/backend/images/cms-logo-BM80Y3XF.png');
  });
});
