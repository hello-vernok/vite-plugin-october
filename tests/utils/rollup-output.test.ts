import { describe, it, expect } from 'vitest';
import { createOctoberRollupOutput } from '../../src/utils/rollup-output.ts';
import { MODULES_SHARED_CHUNK_DIR } from '../../src/utils/constants.ts';

describe('createOctoberRollupOutput', () => {
  it('maps shared chunks to modules/_shared', () => {
    const output = createOctoberRollupOutput(
      (name) => `modules/${name}/entrypoint-[hash].js`,
      (name) => `modules/${name}/entrypoint-[hash].css`
    );

    expect(output.chunkFileNames).toBe(`${MODULES_SHARED_CHUNK_DIR}/[name]-[hash].js`);
  });
});
