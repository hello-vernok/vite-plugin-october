import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { resolveViteDevOrigin, setupDevMarker } from "../../src/utils/dev.ts";

async function rimraf(dir: string) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("waitFor timeout");
}

function createServer(root: string) {
  const httpServer = new EventEmitter() as EventEmitter & {
    address: () => { address: string; port: number };
  };
  httpServer.address = () => ({ address: "::", port: 5177 });

  const server: any = {
    config: {
      root,
      server: {}
    },
    httpServer,
    resolvedUrls: undefined
  };
  return server;
}

describe("utils/dev.ts - setupDevMarker", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "vite-dev-marker-"));
  });

  afterEach(async () => {
    await rimraf(root);
  });

  it("writes .vite-dev and .vite-dev.json with origin metadata", async () => {
    const server = createServer(root);
    server.config.server.origin = "http://host.docker.internal:5173";
    setupDevMarker(server, false, () => {});

    const markerPath = path.join(root, ".vite-dev");
    const jsonPath = path.join(root, ".vite-dev.json");

    await waitFor(async () => {
      try {
        await fs.access(markerPath);
        await fs.access(jsonPath);
        return true;
      } catch {
        return false;
      }
    });

    const jsonRaw = await fs.readFile(jsonPath, "utf8");
    const json = JSON.parse(jsonRaw);
    expect(json.origin).toBe("http://host.docker.internal:5173");
    expect(json.mode).toBe("dev");
    expect(typeof json.pid).toBe("number");
  });

  it("updates .vite-dev.json origin after listening when resolvedUrls are known", async () => {
    const server = createServer(root);
    server.config.server.origin = "http://localhost:4000";
    setupDevMarker(server, false, () => {});

    server.resolvedUrls = {
      local: ["http://localhost:5174/"],
      network: []
    };
    server.httpServer.emit("listening");

    const jsonPath = path.join(root, ".vite-dev.json");
    await waitFor(async () => {
      try {
        const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
        return json.origin === "http://localhost:5174";
      } catch {
        return false;
      }
    });
  });

  it("does not default .vite-dev.json origin to localhost:5173 when origin cannot be resolved", async () => {
    const server = createServer(root);
    // Make origin resolution impossible:
    server.config.server = {};
    server.resolvedUrls = undefined;
    server.httpServer.address = () => undefined as any;

    setupDevMarker(server, true, () => {});

    const jsonPath = path.join(root, ".vite-dev.json");
    await waitFor(async () => {
      try {
        const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
        return !("origin" in json);
      } catch {
        return false;
      }
    });

    const jsonRaw = await fs.readFile(jsonPath, "utf8");
    const json = JSON.parse(jsonRaw);
    expect(json.origin).toBeUndefined();
    expect(jsonRaw).not.toContain("http://localhost:5173");
  });

  it("can resolve origin from on-disk .vite-dev.json", async () => {
    const server = createServer(root);
    // Simulate a case where Vite didn't provide origin yet, but previous metadata exists.
    server.resolvedUrls = undefined;
    server.config.server = {};
    (server.httpServer as any).address = () => undefined;

    const metaPath = path.join(root, ".vite-dev.json");
    await fs.writeFile(metaPath, JSON.stringify({ origin: "http://localhost:4999", pid: 1, mode: "dev" }), "utf8");

    const origin = resolveViteDevOrigin(server as any);
    expect(origin).toBe("http://localhost:4999");
  });

  it("removes both marker files on server close", async () => {
    const server = createServer(root);
    setupDevMarker(server, false, () => {});

    const markerPath = path.join(root, ".vite-dev");
    const jsonPath = path.join(root, ".vite-dev.json");

    await waitFor(async () => {
      try {
        await fs.access(markerPath);
        await fs.access(jsonPath);
        return true;
      } catch {
        return false;
      }
    });

    server.httpServer.emit("close");

    await waitFor(async () => {
      try {
        await fs.access(markerPath);
        return false;
      } catch {
        try {
          await fs.access(jsonPath);
          return false;
        } catch {
          return true;
        }
      }
    });
  });
});
