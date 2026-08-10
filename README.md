# @vernok/vite-plugin-october

Zero-configuration Vite 8 plugins for OctoberCMS plugin and theme development. Built for agencies and developers who ship production OctoberCMS projects and need a predictable, manifest-driven frontend build without hand-maintaining Rollup entry maps.

This npm package handles Vite configuration, entrypoint autodiscovery, build output layout, and local development integration. It works alongside **[Vernok.Vite](https://github.com/hello-vernok/oc-vite-plugin)** ([`vernok/oc-vite-plugin` on Packagist](https://packagist.org/packages/vernok/oc-vite-plugin)), which resolves manifests and dev-server state on the PHP side.

| Export | Use when |
|---|---|
| `octoberPlugin()` | You are building an OctoberCMS **plugin** (`plugins/<vendor>/<plugin>/`) |
| `octoberTheme()` | You are building an OctoberCMS **theme** (`themes/<theme>/`) |

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Project setup](#project-setup)
- [Quick start](#quick-start)
- [Public API](#public-api)
- [Configuration reference](#configuration-reference)
- [Entry discovery and build output](#entry-discovery-and-build-output)
- [Asset handling](#asset-handling)
- [Local development and Docker](#local-development-and-docker)
- [Production builds](#production-builds)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Developing this package](#developing-this-package)
- [License](#license)

## Overview

OctoberCMS frontend assets are split across two packages:

| Package | Runs in | Responsibility |
|---|---|---|
| `@vernok/vite-plugin-october` (this package) | Plugin or theme repository (Node) | Vite config, entry autodiscovery, `assets/` output, `.vite-dev.json` during dev |
| [`vernok/oc-vite-plugin`](https://packagist.org/packages/vernok/oc-vite-plugin) (`Vernok.Vite`) | OctoberCMS application (PHP) | Dev-server detection, manifest resolution, rendering assets in templates and PHP |

Agencies benefit from shared conventions—the same folder layout, output structure, and cache-busting behaviour in every client repository. Developers get out-of-the-box defaults via `definePluginConfig()` and `defineThemeConfig()`, so a new plugin or theme can start with a single Vite config file and focus on application code rather than bundler wiring.

## Architecture

- **Development:** run `vite dev` in the plugin or theme directory. This package writes `.vite-dev.json` in that directory (the Vite project root). **Vernok.Vite** uses this file during development — see the [PHP package documentation](https://github.com/hello-vernok/oc-vite-plugin).
- **Production:** run `vite build`. Output lands in `assets/` with `assets/.vite/manifest.json`. **Vernok.Vite** resolves hashed entry filenames from the manifest.

> **PHP integration:** see the [Vernok.Vite documentation](https://github.com/hello-vernok/oc-vite-plugin) for installing the companion plugin, registering entrypoints, and rendering assets in development and production. Install via [Packagist](https://packagist.org/packages/vernok/oc-vite-plugin) or GitHub. This README covers the Node/Vite side only.

## Requirements

### OctoberCMS application

- **[`vernok/oc-vite-plugin`](https://packagist.org/packages/vernok/oc-vite-plugin)** (`Vernok.Vite`) installed in the OctoberCMS project that serves your site
- Supported OctoberCMS and PHP versions are documented in the [PHP package README](https://github.com/hello-vernok/oc-vite-plugin)

### Plugin or theme repository (this package)

- Node.js **≥ 24.11.1**
- Vite **^8.0.0** (peer dependency)
- JavaScript or TypeScript — use `vite.config.js` or `vite.config.ts`, and `entrypoint.js` or `entrypoint.ts` (both are autodiscovered)

## Installation

### 1. OctoberCMS project (PHP)

Install the companion plugin in the OctoberCMS application that will serve your site:

```bash
composer require vernok/oc-vite-plugin
```

Or via the OctoberCMS plugin manager:

```bash
php artisan plugin:install Vernok.Vite
```

Source: [github.com/hello-vernok/oc-vite-plugin](https://github.com/hello-vernok/oc-vite-plugin) · [packagist.org/packages/vernok/oc-vite-plugin](https://packagist.org/packages/vernok/oc-vite-plugin)

#### Declaring `Vernok.Vite` as a dependency

Where you declare the dependency depends on **what you ship** (plugin vs. theme) and **how it is installed** (October plugin manager vs. Composer).

| You maintain | Declare in | Required? |
|---|---|---|
| OctoberCMS **plugin** that uses Vite-built assets | `plugin.yaml` → `require` | **Yes** — October installs missing plugins when your plugin is installed |
| Same plugin, distributed via **Composer** | Plugin `composer.json` → `require` | **Yes** — `vernok/oc-vite-plugin` (keep in sync with `plugin.yaml`) |
| OctoberCMS **theme** that uses Vite-built assets | `theme.yaml` → `require` | **Yes** — October installs required plugins when the theme is installed |
| Same theme, distributed via **Composer** | Theme `composer.json` → `require` | **Yes** — same rule as for plugins |

**Plugin — `plugin.yaml`** (October plugin manager):

```yaml
require:
  - Vernok.Vite
```

**Plugin — `composer.json`** (only when your plugin is a Composer package):

```json
{
  "require": {
    "vernok/oc-vite-plugin": "^0.0.2"
  }
}
```

**Theme — `theme.yaml`**:

```yaml
require:
  - Vernok.Vite
```

**Theme — `composer.json`** (only when your theme is a Composer package):

```json
{
  "require": {
    "vernok/oc-vite-plugin": "^0.0.2"
  }
}
```

If your plugin or theme is **not** installed via Composer (for example, only committed under `plugins/` or `themes/` in a project repo), `plugin.yaml` or `theme.yaml` is enough for October’s dependency resolution. Add `vernok/oc-vite-plugin` to `composer.json` when you publish or distribute through Composer so both install paths stay aligned.

### 2. Plugin or theme repository (Node)

In the repository that contains your Vite config (`vite.config.ts` or `vite.config.js`):

```bash
npm i -D @vernok/vite-plugin-october vite
```

## Project setup

### Recommended folder layout — plugin

```
plugins/<vendor>/<plugin>/
├── vite.config.ts           # or vite.config.js
├── package.json
├── resources/
│   ├── formwidgets/<name>/entrypoint.ts   # or entrypoint.js
│   └── modules/<name>/entrypoint.ts
└── assets/                  # build output
    └── .vite/
        └── manifest.json
```

### Recommended folder layout — theme

```
themes/<theme>/
├── vite.config.ts           # or vite.config.js
├── package.json
├── resources/
│   ├── entrypoint.ts        # or entrypoint.js — site-wide bundle
│   └── modules/<name>/entrypoint.ts
└── assets/
    └── .vite/
        └── manifest.json
```

Autodiscovery looks only for `entrypoint.{ts,js}` files. Internal folders such as `scss/`, `ts/`, or `images/` are a project convention—you import them from your entrypoint; they are not discovered automatically.

### Recommended `package.json` scripts

Add these scripts to your plugin or theme repository:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

Run `npm run dev` while developing. Run `npm run build` before deployment (or let CI run the build step).

### Recommended `.gitignore` entries

```
.vite-dev.json
node_modules/
```

Whether you commit the `assets/` directory depends on your deployment workflow. Many teams commit built `assets/` (including `assets/.vite/manifest.json`) for production deploys; others build in CI and deploy the artefact.

### Multi-plugin setups

Each plugin or theme with its own Vite config writes **its own** `.vite-dev.json` in that repository root. **Vernok.Vite** resolves dev and production assets per registered source — see the [PHP package documentation](https://github.com/hello-vernok/oc-vite-plugin).

## Quick start

Add `vite.config.ts` or `vite.config.js` at the root of your plugin or theme repository.

### OctoberCMS plugin

```ts
import { definePluginConfig } from '@vernok/vite-plugin-october';

export default definePluginConfig();
```

`definePluginConfig()` registers `octoberPlugin()`, applies October-friendly build defaults, and accepts optional overrides.

For explicit control:

```ts
import { definePluginConfig, octoberPlugin } from '@vernok/vite-plugin-october';

export default definePluginConfig({
  plugins: [octoberPlugin()],
});
```

### OctoberCMS theme

```ts
import { defineThemeConfig } from '@vernok/vite-plugin-october';

export default defineThemeConfig();
```

## Public API

```ts
import {
  octoberPlugin,
  octoberTheme,
  definePluginConfig,
  defineThemeConfig,
  type OctoberPluginOptions,
  type OctoberThemeOptions,
} from '@vernok/vite-plugin-october';
```

| Interface | Used with | Fields |
|---|---|---|
| `OctoberPluginOptions` | `octoberPlugin()` | `enabled?`, `debug?`, `hostUrl?` |
| `OctoberThemeOptions` | `octoberTheme()` | Same fields as `OctoberPluginOptions` |

Both option interfaces share the same shape. Pass them to the plugin factory or rely on defaults when using `definePluginConfig()` / `defineThemeConfig()` without arguments.

## Configuration reference

### Defaults from `definePluginConfig()` and `defineThemeConfig()`

| Setting | Default | Purpose |
|---|---|---|
| `build.outDir` | `"assets"` | October-friendly build output directory |
| `build.emptyOutDir` | `true` | Remove previous build output before each build |
| `build.assetsDir` | `""` | Emit assets directly under `outDir`, not in a nested folder |
| `build.manifest` | `true` | Write `assets/.vite/manifest.json` for **Vernok.Vite** |
| `build.assetsInlineLimit` | `0` | Keep fonts and images as separate files |
| `server.cors` | `true` | Enable CORS during development |
| `css.preprocessorOptions.scss.quietDeps` | `true` | Reduce SCSS dependency deprecation noise |
| `experimental.renderBuiltUrl` | `{ relative: true }` for CSS | Relative asset URLs in production CSS |

`octoberTheme()` additionally sets `appType: "custom"` because OctoberCMS serves HTML, not Vite.

### Plugin registration and overrides

`definePluginConfig()` and `defineThemeConfig()` automatically insert `octoberPlugin()` or `octoberTheme()` unless a plugin with the same internal name is already present in `plugins`. When you pass arrays (for example `plugins`), they are concatenated with the defaults rather than replaced.

### Plugin and theme options

Both `octoberPlugin()` and `octoberTheme()` accept optional settings:

| Option | Description |
|---|---|
| `enabled` | Enable or disable plugin hooks (default: `true`) |
| `debug` | Log prefixed debug output to the console (default: `false`) |
| `hostUrl` | Explicit dev-server origin for Docker or VM setups where PHP cannot reach host `localhost` |

```ts
octoberPlugin({ debug: true, hostUrl: 'http://host.docker.internal:5173' });
octoberTheme({ debug: true, hostUrl: 'http://host.docker.internal:5173' });
```

## Entry discovery and build output

### Supported entry types

| Context | Discovered |
|---|---|
| Plugin | `formwidgets`, `modules` |
| Theme | Root `entrypoint`, `modules` |

Only files named `entrypoint.{ts,js}` at the paths documented below are picked up. Other files under `resources/` are ignored unless imported from an entrypoint.

### When no entrypoints are found

| Export | Behaviour |
|---|---|
| `octoberPlugin()` | Build continues without Rollup `input` (no error) |
| `octoberTheme()` | Throws an error listing expected paths; use `octoberTheme({ debug: true })` to inspect discovery |

### `octoberPlugin()` — source and output

Entrypoints are discovered under `resources/`:

| Type | Source path |
|---|---|
| FormWidget | `resources/formwidgets/<name>/entrypoint.{ts,js}` |
| Module | `resources/modules/<name>/entrypoint.{ts,js}` |

With `build.outDir = 'assets'` (the default), outputs are written as follows.

Entry JavaScript and CSS use fixed `entrypoint-[hash]` names. Fonts and images **imported from the entrypoint** (or its dependency graph) are emitted as `[name]-[hash].<ext>` (for example `logo-BM80Y3XF.png`) and placed under the `fonts/` or `images/` folder for that entry.

#### FormWidgets

| Asset | Output path |
|---|---|
| JavaScript | `assets/formwidgets/<name>/entrypoint-[hash].js` |
| CSS | `assets/formwidgets/<name>/entrypoint-[hash].css` |
| Images (imported) | `assets/formwidgets/<name>/images/[name]-[hash].<ext>` |
| Fonts (imported) | `assets/formwidgets/<name>/fonts/[name]-[hash].<ext>` |

Example: `assets/formwidgets/alpha/images/logo-BM80Y3XF.png`

#### Modules

| Asset | Output path |
|---|---|
| JavaScript | `assets/modules/<name>/entrypoint-[hash].js` |
| CSS | `assets/modules/<name>/entrypoint-[hash].css` |
| Images (imported) | `assets/modules/<name>/images/[name]-[hash].<ext>` |
| Fonts (imported) | `assets/modules/<name>/fonts/[name]-[hash].<ext>` |

Example: `assets/modules/cart/images/cms-logo-BM80Y3XF.png`

### `octoberTheme()` — source and output

Entrypoints are discovered under the theme `resources/` directory:

| Type | Source path |
|---|---|
| Theme (global) | `resources/entrypoint.{ts,js}` |
| Module (page-specific) | `resources/modules/<name>/entrypoint.{ts,js}` |

Use the **root entrypoint** for site-wide CSS and JavaScript. Use **modules** when a specific CMS page needs its own bundle—for example, a Vue or React application that should not load on every page.

With `build.outDir = 'assets'`, outputs are written as follows. Naming rules match the plugin tables above: entry bundles use `entrypoint-[hash]`; imported fonts and images use `[name]-[hash].<ext>` under `fonts/` or `images/`.

#### Theme root

| Asset | Output path |
|---|---|
| JavaScript | `assets/js/entrypoint-[hash].js` |
| CSS | `assets/css/entrypoint-[hash].css` |
| Images (imported) | `assets/images/[name]-[hash].<ext>` |
| Fonts (imported) | `assets/fonts/[name]-[hash].<ext>` |

Example: `assets/images/hero-D4k9s1Qa.webp`

#### Theme modules

| Asset | Output path |
|---|---|
| JavaScript | `assets/modules/<name>/entrypoint-[hash].js` |
| CSS | `assets/modules/<name>/entrypoint-[hash].css` |
| Images (imported) | `assets/modules/<name>/images/[name]-[hash].<ext>` |
| Fonts (imported) | `assets/modules/<name>/fonts/[name]-[hash].<ext>` |

Example: `assets/modules/blog/images/cover-BM80Y3XF.jpg`

During `vite dev`, both plugin variants serve static font and image files referenced by absolute paths under `/resources/`, `/plugins/`, `/modules/`, and `/themes/`.

## Asset handling

### Cache busting and manifests

All built assets are content-hashed. The pattern depends on the asset type:

| Asset kind | Filename pattern |
|---|---|
| Entry JavaScript and CSS | `entrypoint-[hash].js` / `entrypoint-[hash].css` |
| Imported fonts and images | `[name]-[hash].<ext>`, relocated under the entry's `fonts/` or `images/` folder (see tables above) |
| Other Rollup-emitted assets | `[name]-[hash].<ext>` (not relocated unless they match a font or image extension) |

`definePluginConfig()` and `defineThemeConfig()` enable `manifest: true`, which writes `assets/.vite/manifest.json` for **Vernok.Vite** to resolve hashed filenames in production.

### CSS URL rewriting

OctoberCMS serves HTML from PHP while Vite serves (or builds) CSS and JavaScript. Absolute asset URLs in CSS need different handling in development and production.

| Mode | Behaviour |
|---|---|
| Development | Absolute URLs under `/resources/`, `/plugins/`, `/modules/`, or `/themes/` in CSS are rewritten to include the Vite dev-server origin so the browser requests them from Vite, not from the PHP host |
| Production | Absolute and relative URLs in emitted CSS are rewritten to relative paths that point at relocated fonts and images under `assets/` |

The dev server also exposes a static middleware for font and image files (see [Known limitations](#known-limitations) for supported extensions) under the four URL prefixes above.

## Local development and Docker

When you run `vite dev`, this package writes `.vite-dev.json` in the **plugin or theme root** (the Vite project root) while the dev server is active. It is removed on shutdown, including Ctrl+C:

| Field | Purpose |
|---|---|
| `pid` | Process ID of the Vite dev server |
| `mode` | Always `"dev"` while the file exists |
| `origin` | Vite dev-server URL (optional until the server is listening) |

This package **writes, reads, and removes** `.vite-dev.json` while `vite dev` is running (for example when resolving the dev origin for CSS URL rewriting).

**Vernok.Vite** reads the same `.vite-dev.json` file from each registered plugin or theme root to detect dev mode and resolve the Vite origin. See the [PHP package documentation](https://github.com/hello-vernok/oc-vite-plugin) for details.

On startup, the file is created immediately. The `origin` field **may be missing at first** until Vite knows the final host and port—there is no default such as `http://localhost:5173`. Once the dev server is listening, the file is updated with the resolved `origin` when available.

Example `.vite-dev.json` after the origin is known:

```json
{
  "origin": "http://localhost:5173",
  "pid": 12345,
  "mode": "dev"
}
```

### Configuring the dev origin

When PHP runs inside Docker or a VM, it often cannot reach `http://localhost` on the host machine. Configure an origin that PHP can reach.

**Option 1 — `hostUrl` in your Vite config (recommended for Docker)**

```ts
import { definePluginConfig, octoberPlugin } from '@vernok/vite-plugin-october';

export default definePluginConfig({
  plugins: [
    octoberPlugin({ hostUrl: 'http://host.docker.internal:5173' }),
  ],
});
```

**Option 2 — environment variable**

```bash
VITE_HOST_URL=http://host.docker.internal:5173 vite
```

**Origin precedence**

1. `server.origin` in your Vite config (highest priority; this package does not override it)
2. Plugin `hostUrl` or `VITE_HOST_URL` during `vite serve` (sets `server.origin`)
3. Auto-detect after the dev server is listening (written to `.vite-dev.json`; may update `server.config.server.origin`)

## Production builds

From your plugin or theme directory:

```bash
npm run build
# or: vite build
```

This produces:

- Built assets under `assets/`
- `assets/.vite/manifest.json` for **Vernok.Vite** to resolve hashed entry filenames

Because `emptyOutDir` defaults to `true`, each build removes the previous contents of `assets/` before writing new output. Commit or deploy the built artefacts according to your project workflow.

See the [Vernok.Vite documentation](https://github.com/hello-vernok/oc-vite-plugin) for how PHP registers and renders entrypoints against the manifest in production.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Theme build fails immediately | No `resources/entrypoint.{ts,js}` or module entrypoint | Create an entrypoint file; run with `octoberTheme({ debug: true })` |
| PHP loads no HMR assets | `.vite-dev.json` missing or has no `origin` | Ensure `vite dev` is running in the plugin/theme directory; set `hostUrl` for Docker |
| CSS images 404 in dev | Absolute URL not under `/resources/`, `/plugins/`, `/modules/`, or `/themes/` | Use supported path prefixes or import assets in JS/SCSS |
| Fonts or images in wrong folder in production | Asset not part of the entry graph | Import the asset from the entrypoint so Rollup tracks ownership |
| Unexpected duplicate plugin behaviour | Two `octoberPlugin()` or `octoberTheme()` instances | Use `definePluginConfig()` / `defineThemeConfig()`, or pass options to a single instance |

## Known limitations

- Entrypoint locations are fixed to the patterns documented above. Custom glob patterns are outside the zero-config scope.
- Plugins discover **formwidgets** and **modules** only; themes discover the **root entrypoint** and **modules** only.
- Recognized image formats: png, jpg, jpeg, gif, webp, avif, svg, ico. Recognized font formats: woff2, woff, ttf, otf, eot.
- During development, the static middleware serves only font and image extensions under the supported URL prefixes.
- CSS URL rewriting runs in both development (prepend Vite origin) and production (relative paths after relocation).

## Developing this package

These commands are for contributors working on `@vernok/vite-plugin-october` itself, not for OctoberCMS plugin or theme repositories.

### Build

```bash
npm run build        # compile TypeScript to dist/
npm publish          # runs build via prepublishOnly
```

### Test

```bash
npm run test
npm run test:watch
```

Vitest covers entrypoint autodiscovery, output path mapping, asset relocation, `.vite-dev.json` lifecycle, and CSS URL rewriting.

## License

MIT © Vernok
