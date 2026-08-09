import { describe, it, expect } from 'vitest';
import type { OutputBundle } from 'rolldown';
import { rewriteCssUrlsInBundle } from '../../src/utils/css.ts';

function makeAsset(name: string, fileName: string, source: string | Uint8Array) {
  return { type: 'asset', name, fileName, source } as any;
}

describe('utils/css.ts - rewriteCssUrlsInBundle', () => {
  it('rewrites absolute project URLs to ./fonts and ./images relative to CSS file', () => {
    const cssName = 'formwidgets/alpha/entrypoint.css';
    const bundle: OutputBundle = {
      [cssName]: makeAsset(
        'fw:alpha:entrypoint.css',
        cssName,
        "@font-face{src:url('/fa-solid-900.ttf')} .bg{background-image:url('/photo.png')}"
      ) as any,
      'fa-solid-900.ttf': makeAsset('fa-solid-900.ttf', 'formwidgets/alpha/fonts/fa-solid-900.ttf', new Uint8Array([0])) as any,
      'photo.png': makeAsset('photo.png', 'formwidgets/alpha/images/photo.png', new Uint8Array([0])) as any
    } as any;

    rewriteCssUrlsInBundle(bundle);

    const out = String((bundle[cssName] as any).source);
    expect(out).toContain("url('./fonts/fa-solid-900.ttf')");
    expect(out).toContain("url('./images/photo.png')");
  });

  it('keeps external and data: URLs unchanged', () => {
    const cssName = 'formwidgets/alpha/entrypoint.css';
    const bundle: OutputBundle = {
      [cssName]: makeAsset(
        'fw:alpha:entrypoint.css',
        cssName,
        "a{background:url('https://cdn.example.com/a.png')} b{background:url(data:image/png;base64,xyz)}"
      ) as any
    } as any;

    rewriteCssUrlsInBundle(bundle);

    const out = String((bundle[cssName] as any).source);
    expect(out).toContain("url('https://cdn.example.com/a.png')");
    expect(out).toContain('url(data:image/png;base64,xyz)');
  });

  it('rewrites urls with query/hash and preserves suffix', () => {
    const cssName = 'formwidgets/alpha/entrypoint.css';
    const bundle: OutputBundle = {
      [cssName]: makeAsset(
        'fw:alpha:entrypoint.css',
        cssName,
        "@font-face{src:url('/fa.ttf?#iefix')}"
      ) as any,
      'fa.ttf': makeAsset('fa.ttf', 'formwidgets/alpha/fonts/fa.ttf', new Uint8Array([0])) as any
    } as any;

    rewriteCssUrlsInBundle(bundle);
    const out = String((bundle[cssName] as any).source);
    expect(out).toContain("url('./fonts/fa.ttf?#iefix')");
  });

  it('rewrites absolute URLs relative to flat module CSS paths', () => {
    const cssName = 'modules/pagination/entrypoint.css';
    const bundle: OutputBundle = {
      [cssName]: makeAsset(
        'mod:pagination:entrypoint.css',
        cssName,
        "@font-face{src:url('/icon.woff2')} .bg{background-image:url('/arrow.svg')}"
      ) as any,
      'icon.woff2': makeAsset('icon.woff2', 'modules/pagination/fonts/icon.woff2', new Uint8Array([0])) as any,
      'arrow.svg': makeAsset('arrow.svg', 'modules/pagination/images/arrow.svg', new Uint8Array([0])) as any
    } as any;

    rewriteCssUrlsInBundle(bundle);

    const out = String((bundle[cssName] as any).source);
    expect(out).toContain("url('./fonts/icon.woff2')");
    expect(out).toContain("url('./images/arrow.svg')");
  });
});
