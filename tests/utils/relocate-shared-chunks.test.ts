import { describe, it, expect } from 'vitest';
import type { OutputBundle } from 'rolldown';
import { relocateThemeSharedChunks } from '../../src/utils/relocate-shared-chunks.ts';
import { JS_SHARED_CHUNK_DIR, MODULES_SHARED_CHUNK_DIR } from '../../src/utils/constants.ts';

describe('relocateThemeSharedChunks', () => {
  it('moves shared chunks imported by the theme root to js/_shared', () => {
    const bundle = {
      'root:entrypoint.js': {
        type: 'chunk',
        name: 'root_entrypoint',
        isEntry: true,
        fileName: 'js/entrypoint-abc.js',
        imports: ['shared.js'],
      },
      'mod:blog:entrypoint.js': {
        type: 'chunk',
        name: 'mod_blog_entrypoint',
        isEntry: true,
        fileName: 'modules/blog/entrypoint-def.js',
        imports: ['shared.js'],
      },
      'shared.js': {
        type: 'chunk',
        name: 'shared',
        isEntry: false,
        fileName: `${MODULES_SHARED_CHUNK_DIR}/shared-ghi.js`,
        imports: [],
      },
    } as unknown as OutputBundle;

    relocateThemeSharedChunks(bundle);

    expect(bundle['shared.js'].fileName).toBe(`${JS_SHARED_CHUNK_DIR}/shared-ghi.js`);
  });

  it('keeps module-only shared chunks under modules/_shared', () => {
    const bundle = {
      'root:entrypoint.js': {
        type: 'chunk',
        name: 'root_entrypoint',
        isEntry: true,
        fileName: 'js/entrypoint-abc.js',
        imports: [],
      },
      'mod:blog:entrypoint.js': {
        type: 'chunk',
        name: 'mod_blog_entrypoint',
        isEntry: true,
        fileName: 'modules/blog/entrypoint-def.js',
        imports: ['shared.js'],
      },
      'mod:shop:entrypoint.js': {
        type: 'chunk',
        name: 'mod_shop_entrypoint',
        isEntry: true,
        fileName: 'modules/shop/entrypoint-hij.js',
        imports: ['shared.js'],
      },
      'shared.js': {
        type: 'chunk',
        name: 'shared',
        isEntry: false,
        fileName: `${MODULES_SHARED_CHUNK_DIR}/shared-ghi.js`,
        imports: [],
      },
    } as unknown as OutputBundle;

    relocateThemeSharedChunks(bundle);

    expect(bundle['shared.js'].fileName).toBe(`${MODULES_SHARED_CHUNK_DIR}/shared-ghi.js`);
  });
});
