import { describe, it, expect } from 'vitest';
import { parseOctoberEntryName } from '../../src/utils/entry-names.ts';

describe('parseOctoberEntryName', () => {
  it('parses colon-separated plugin and theme entry names', () => {
    expect(parseOctoberEntryName('mod:cart:entrypoint')).toEqual({ tag: 'mod', entryName: 'cart' });
    expect(parseOctoberEntryName('mod:content_example:entrypoint')).toEqual({
      tag: 'mod',
      entryName: 'content_example'
    });
    expect(parseOctoberEntryName('fw:my_picker:entrypoint')).toEqual({
      tag: 'fw',
      entryName: 'my_picker'
    });
    expect(parseOctoberEntryName('root:entrypoint')).toEqual({ tag: 'root', entryName: '' });
  });

  it('parses Rolldown-sanitized entry names with underscores in the middle segment', () => {
    expect(parseOctoberEntryName('mod_cart_entrypoint')).toEqual({ tag: 'mod', entryName: 'cart' });
    expect(parseOctoberEntryName('mod_content_example_entrypoint')).toEqual({
      tag: 'mod',
      entryName: 'content_example'
    });
    expect(parseOctoberEntryName('fw_my_picker_entrypoint')).toEqual({
      tag: 'fw',
      entryName: 'my_picker'
    });
    expect(parseOctoberEntryName('root_entrypoint')).toEqual({ tag: 'root', entryName: '' });
  });

  it('parses CSS asset base names', () => {
    expect(parseOctoberEntryName('mod_content_example_entrypoint.css')).toEqual({
      tag: 'mod',
      entryName: 'content_example'
    });
  });

  it('rejects malformed names', () => {
    expect(parseOctoberEntryName('mod_only_two_parts')).toBeNull();
    expect(parseOctoberEntryName('unknown:foo:entrypoint')).toBeNull();
    expect(parseOctoberEntryName('root:site:entrypoint')).toBeNull();
    expect(parseOctoberEntryName('mod::entrypoint')).toBeNull();
  });
});
