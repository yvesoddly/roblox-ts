# roblox-ts Extensions

## Workspace import

Imported from [roblox-ts/roblox-ts-extensions](https://github.com/roblox-ts/roblox-ts-extensions/tree/6ba1d257026feeea2026e5dbe6b2341ecfa0e720),
commit `6ba1d257026feeea2026e5dbe6b2341ecfa0e720` (version `1.8.1`). Source, MIT license,
entry point, and Rojo schema are preserved. Git metadata and the standalone npm lockfile are omitted.
The package still publishes `index.js`, `plugin/`, and `rojo-schema.json`, plus npm's default README/license/manifest.
The vendored Rojo/path helpers remain unchanged because replacing them could change language-service behavior.

Local changes are repository metadata, behavioral tests, exact `5.5.3` pins for the upstream-locked
TypeScript/internal-declarations pair, and Node-only TypeScript libraries. The latter avoids an upstream
DOM/Node `AbortSignal` declaration conflict without suppressing type checking or changing emitted JavaScript.

From the workspace root after dependencies are installed:

```sh
pnpm --filter roblox-ts-extensions build
pnpm --filter roblox-ts-extensions test
```

Validation during import used Node `24.19.0`, npm `11.17.0`, and isolated dependencies outside the repository:

- `npm --prefix packages/roblox-ts-extensions run build` passed
- `npm --prefix packages/roblox-ts-extensions test` passed all 7 tests with TypeScript `5.5.3`
- the same suite passed with host TypeScript `5.9.3`, selected using `TYPESCRIPT_PATH`
- `npm pack ./packages/roblox-ts-extensions --pack-destination <scratch>` produced the expected 34-file package
- all 7 tests also passed against a production-only installation of that tarball with TypeScript `5.9.3`,
  selecting its entry point using `PLUGIN_PATH`

Tests exercise actual TypeScript language services: project detection and duplicate injection, diagnostics and
quick fixes, configuration/cache invalidation, member and auto-import completions, Rojo mapping, and error fallback.
Upstream has no tests. This is not an interactive VS Code/tsserver integration test.

Preserved limitation: automatic type-only completion edits match legacy `Import '…' from module` action descriptions.
TypeScript `5.5.3` and `5.9.3` produce `Add import from` descriptions, so that automatic rewrite does not run;
the explicit cross-boundary diagnostic quick fix works. The tests cover both current host details and the supported
legacy action description. Other upstream behavior, including the configuration documentation below, is unchanged.

Shared integration still requires a workspace lockfile refresh and adding this package to the root `test-packages`
filters. The existing `packages/*` workspace glob and recursive build already discover it. The VS Code package
should depend on `roblox-ts-extensions` via `workspace:*` and build this plugin before packing its production dependency
closure. Root lint/format checks also need package-scoped `vite.config.ts` overrides or exclusions for upstream
formatting/CommonJS conventions and generated `plugin/**` output. The imported sources are not reformatted to satisfy
compiler-specific lint rules. This import does not change shared configuration or the lockfile.

## Overview

This is a Language Service plugin that improves the editing experience while using roblox-ts.

### Features

- Remove or prefix cross-boundary imports in intellisense.
- Warn about non-type only cross-boundary imports.
- Remove internal fields from roblox-ts types.
- Remove deprecated entries from intellisense.
- Remove @hidden entries from intellisense.

## Visual Studio Code

If you use Visual Studio Code, it's recommended that you install this using [our extension.](https://marketplace.visualstudio.com/items?itemName=Roblox-TS.vscode-roblox-ts)

## Installation

You install this like you would any npm package.

`npm install --save-dev roblox-ts-extensions`

To enable the plugin and configure it, please look to the sections below.

## Configuration

```ts
interface PluginConfig {
	// The directories to be determined client-sided. Rojo is preferred, however these can override Rojo if necessary.
	// Default: []
	client: string | string[];

	// The directories to be determined server-sided. Rojo is preferred, however these can override Rojo if necessary.
	// Default: []
	server: string | string[];

	// The autocomplete mode to use.
	// Prefix: Prefixes completes with their network boundary, and makes cross-boundary (client<->server, shared->client/server) imports type only.
	// Remove: Removes any cross-boundary imports entirely. Does not affect manual imports or existing imports.
	// Default: prefix
	mode: "prefix" | "remove";

	// Whether to use Rojo to calculate server/client boundaries. The client and server properties can override certain directories if necessary.
	// Default: true
	useRojo: boolean;

	// What should non-type only cross-boundary imports be flagged as.
	// Set to off to disable diagnostics.
	// Default: warning
	diagnosticsMode: "off" | "warning" | "error" | "message";
}
```

## Enabling

To enable the plugin, add the following "plugins" field to your tsconfig's compilerOptions. You can configure the plugin however you'd like, as shown above.

```jsonc
{
	"compilerOptions": {
		// ...
		"plugins": [
			{
				"name": "roblox-ts-extensions",

				// All the following fields are optional and will use their defaults if omitted.

				"client": [],
				"server": [],
				"mode": "prefix",
				"useRojo": true,
			},
		],
	},
}
```
