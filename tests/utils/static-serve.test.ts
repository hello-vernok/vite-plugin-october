import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installStaticAssetMiddleware } from '../../src/utils/static-serve.ts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function makeServer(root: string) {
  const stack: any[] = [];
  return {
    config: { root, server: { fs: { allow: [] as string[] } } },
    middlewares: { use: (fn: any) => stack.push(fn) },
    _stack: stack
  } as any;
}

function mockReqRes(url: string) {
  const chunks: Buffer[] = [];
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    end(buf?: any) { if (buf) chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf)); }
  } as any;
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return [{ url } as any, res, next, chunks, () => nextCalled] as const;
}

async function rimraf(dir: string) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
}

describe('utils/static-serve.ts - installStaticAssetMiddleware', () => {
  let root: string;
  let server: any;
  let handler: any;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'static-serve-'));
    // create whitelisted dirs
    await fs.mkdir(path.join(root, 'resources'), { recursive: true });
    await fs.mkdir(path.join(root, 'modules'), { recursive: true });
    await fs.writeFile(path.join(root, 'resources', 'a.png'), new Uint8Array([1,2,3]));
    await fs.writeFile(path.join(root, 'modules', 'icon.svg'), new TextEncoder().encode('<svg/>'));
    await fs.writeFile(path.join(root, 'resources', 'note.txt'), new TextEncoder().encode('nope'));

    server = makeServer(root);
    installStaticAssetMiddleware(server, false, () => {});
    handler = server._stack[0];
  });

  afterAll(async () => {
    await rimraf(root);
  });

  it('serves whitelisted asset with correct mime', async () => {
    const [req, res, next, chunks, nextCalled] = mockReqRes('/resources/a.png');
    await handler(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/png');
    expect(Buffer.concat(chunks).length).toBe(3);
    expect(nextCalled()).toBe(false);
  });

  it('passes through for unknown extensions', async () => {
    const [req, res, next, _chunks, nextCalled] = mockReqRes('/resources/note.txt');
    await handler(req, res, next);
    expect(nextCalled()).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it('serves assets even when a cache-busting query is present', async () => {
    const [req, res, next, chunks, nextCalled] = mockReqRes('/modules/icon.svg?version=1');
    await handler(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/svg+xml');
    expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    expect(nextCalled()).toBe(false);
  });

  it('prevents path escape outside root', async () => {
    const [req, res, next, _chunks, nextCalled] = mockReqRes('/resources/../secrets.png');
    await handler(req, res, next);
    expect(nextCalled()).toBe(true);
  });
});
