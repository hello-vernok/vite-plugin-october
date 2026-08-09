# @vernok/vite-plugin-october

Zero-configuration Vite 8 plugins for OctoberCMS plugin and theme development. Built for **agencies and developers** who ship production OctoberCMS projects and need a predictable, manifest-driven frontend build without hand-maintaining Rollup entry maps.

This package handles Vite configuration, entrypoint autodiscovery, cache-busted output paths, and local development integration. It is designed to work alongside the **`Vernok.Vite`** OctoberCMS plugin, which resolves manifests and dev-server state on the PHP side.

| Export | Use when |
|---|---|
| `octoberPlugin()` | You are building an OctoberCMS **plugin** (`plugins/<vendor>/<plugin>/`) |
| `octoberTheme()` | You are building an OctoberCMS **theme** (`themes/<theme>/`) |

## Who this is for

**Agencies** standardizing Vite across multiple client plugins and themes benefit from shared conventions: the same folder layout, output structure, and cache-busting behavior in every repository.

**Developers** get out-of-the-box defaults via `definePluginConfig()` and `defineThemeConfig()`, so a new plugin or theme can start with a single `vite.config.ts` and focus on application code rather than bundler wiring.

## Requirements

This npm package covers the **frontend build toolchain only**. Every OctoberCMS project that consumes built assets must also have **`Vernok.Vite`** installed.

| Component | Responsibility |
|---|---|
| `@vernok/vite-plugin-october` (this package) | Vite config, autodiscovery, build output layout, dev marker files |
| `Vernok.Vite` (OctoberCMS plugin) | Manifest-aware asset registration in PHP for development and production |

### Runtime

- OctoberCMS with **`Vernok.Vite`** installed
- Node.js 24.11.1 LTS or newer
- Vite 8
- TypeScript (recommended for plugin and theme source)

### npm dependencies (this package)

- fast-glob
- lodash-es

## Installation

### 1. OctoberCMS project (PHP)

Install the companion plugin in the OctoberCMS application that will serve your site:

```bash
php artisan plugin:install Vernok.Vite
```

If you maintain a custom OctoberCMS plugin that ships Vite-built assets, declare the dependency in `plugin.yaml` so downstream projects install it automatically:

```yaml
require:
  - Vernok.Vite
```

### 2. Plugin or theme repository (Node)

In the repository that contains `vite.config.ts` (your OctoberCMS plugin or theme):

```bash
npm i -D @vernok/vite-plugin-october vite
```

## Public API

```ts
import {
  octoberPlugin,
  octoberTheme,
  definePluginConfig,
  defineThemeConfig
} from '@vernok/vite-plugin-october';
```

## Quick start

Add `vite.config.ts` at the root of your plugin or theme repository.

### OctoberCMS plugin

```ts
import { definePluginConfig } from '@vernok/vite-plugin-october';

export default definePluginConfig();
```

`definePluginConfig()` registers `octoberPlugin()`, applies October-friendly build defaults (`outDir: assets`, `manifest: true`, and related settings), and accepts optional overrides.

For explicit control:

```ts
import { definePluginConfig, octoberPlugin } from '@vernok/vite-plugin-october';

export default definePluginConfig({
  plugins: [octoberPlugin()]
});
```

### OctoberCMS theme

```ts
import { defineThemeConfig } from '@vernok/vite-plugin-october';

export default defineThemeConfig();
```

## Autodiscovery and build output — `octoberPlugin()`

Entrypoints are discovered automatically under `resources/`:

| Type | Source path |
|---|---|
| FormWidget | `resources/formwidgets/<name>/entrypoint.{ts,js}` |
| Module | `resources/modules/<name>/entrypoint.{ts,js}` |

With `build.outDir = 'assets'` (the default via `definePluginConfig()`), outputs are written as follows.

### FormWidgets

| Asset | Output path |
|---|---|
| JavaScript | `assets/formwidgets/<name>/entrypoint-[hash].js` |
| CSS | `assets/formwidgets/<name>/entrypoint-[hash].css` |
| Images | `assets/formwidgets/<name>/images/*` |
| Fonts | `assets/formwidgets/<name>/fonts/*` |

### Modules

| Asset | Output path |
|---|---|
| JavaScript | `assets/modules/<name>/entrypoint-[hash].js` |
| CSS | `assets/modules/<name>/entrypoint-[hash].css` |
| Images | `assets/modules/<name>/images/*` |
| Fonts | `assets/modules/<name>/fonts/*` |

During `vite dev`, the plugin also serves static assets referenced by absolute paths under `/resources`, `/plugins`, `/modules`, and `/themes`, so existing OctoberCMS URL patterns work without additional middleware configuration.

## Autodiscovery and build output — `octoberTheme()`

Entrypoints are discovered under the theme `resources/` directory:

| Type | Source path |
|---|---|
| Theme (global) | `resources/entrypoint.{ts,js}` |
| Module (page-specific) | `resources/modules/<name>/entrypoint.{ts,js}` |

Use the **root entrypoint** for site-wide CSS and JavaScript. Use **modules** when a specific CMS page needs its own bundle—for example, a Vue or React application that should not load on every page.

With `build.outDir = 'assets'`, outputs are written as follows.

### Theme root

| Asset | Output path |
|---|---|
| JavaScript | `assets/js/entrypoint-[hash].js` |
| CSS | `assets/css/entrypoint-[hash].css` |
| Images | `assets/images/*` |
| Fonts | `assets/fonts/*` |

### Theme modules

| Asset | Output path |
|---|---|
| JavaScript | `assets/modules/<name>/entrypoint-[hash].js` |
| CSS | `assets/modules/<name>/entrypoint-[hash].css` |
| Images | `assets/modules/<name>/images/*` |
| Fonts | `assets/modules/<name>/fonts/*` |

Dev-server static asset handling matches `octoberPlugin()`.

## Cache busting and manifests

Cache busting is enabled by default. Entry JavaScript and CSS files include a content hash (`entrypoint-[hash].js`, `entrypoint-[hash].css`). Other emitted assets use `[name]-[hash][extname]`.

`definePluginConfig()` and `defineThemeConfig()` also set:

- `manifest: true` — writes `manifest.json` for **`Vernok.Vite`** to resolve hashed filenames in production
- `assetsInlineLimit: 0` — keeps fonts and images as separate files rather than inline data URLs

## Plugin options

Both `octoberPlugin()` and `octoberTheme()` accept optional settings:

| Option | Description |
|---|---|
| `enabled` | Enable or disable plugin hooks (default: `true`) |
| `debug` | Log prefixed debug output to the console (default: `false`) |
| `hostUrl` | Explicit dev-server origin (recommended for Docker or VM setups) |

```ts
octoberPlugin({ debug: true, hostUrl: 'http://host.docker.internal:5173' });
octoberTheme({ debug: true, hostUrl: 'http://host.docker.internal:5173' });
```

## Local development and Docker

When you run `vite dev`, PHP inside Docker often cannot reach `http://localhost` on the host machine. This package writes marker files at the project root while the dev server is active and removes them on shutdown (including Ctrl+C):

| File | Purpose |
|---|---|
| `.vite-dev` | Presence marker indicating dev mode is active |
| `.vite-dev.json` | Metadata for multi-project dev resolution (`origin`, `pid`, `mode`) |

**`Vernok.Vite`** reads `.vite-dev.json` to determine the correct Vite origin in development and falls back to `.vite-dev` when needed. In production it loads hashed assets from the build manifest.

Example `.vite-dev.json` written during `vite dev`:

```json
{
  "origin": "http://localhost:5173",
  "pid": 12345,
  "mode": "dev"
}
```

### Configuring the dev origin

You can control which origin Vite advertises for HMR and CSS URL rewriting:

**Option 1 — `hostUrl` in `vite.config.ts` (recommended)**

```ts
import { definePluginConfig, octoberPlugin } from '@vernok/vite-plugin-october';

export default definePluginConfig({
  plugins: [
    octoberPlugin({ hostUrl: 'http://host.docker.internal:5173' })
  ]
});
```

**Option 2 — environment variable**

```bash
VITE_HOST_URL=http://host.docker.internal:5173 vite
```

**Origin precedence**

1. `server.origin` in your Vite config (highest priority)
2. Plugin `hostUrl` or `VITE_HOST_URL`
3. Vite auto-detects host and port (including dynamically assigned ports)

## Building this package from source

```bash
npm run build        # compile TypeScript to dist/
npm publish          # runs build via prepublishOnly
```

## Testing

```bash
npm run test
npm run test:watch
```

Vitest covers entrypoint autodiscovery, output path mapping, asset relocation, and CSS URL rewriting.

## Known limitations

- Entrypoint locations are fixed to the patterns documented above. Custom glob patterns are outside the zero-config scope.
- Recognized image formats: png, jpg, jpeg, gif, webp, avif, svg, ico. Recognized font formats: woff2, woff, ttf, otf, eot.
- During production builds, absolute CSS URLs (for example `/photo.png`) are rewritten to relative paths that point at relocated assets.

## License

MIT © Vernok
