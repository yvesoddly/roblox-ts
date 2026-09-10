# Upstream import

Imported from [roblox-ts/eslint-plugin-roblox-ts](https://github.com/roblox-ts/eslint-plugin-roblox-ts)
at commit `e1581d4f3d83a3d05b015a0a216507c3a20016de` (package version `1.4.1`).
The upstream MIT license, public exports, configs, rules, documentation, tests,
fixtures, and development scripts are preserved.

## Workspace integration

- Package and fixture manifests use explicit versions instead of nested catalogs.
  The redundant package-local workspace and lockfile are replaced by the root
  `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
- `@roblox-ts/luau-ast` links the local workspace package. TypeScript remains
  5.9.3; the plugin retains its Vitest 4.0.18/Vite 7.2.2 and Oxlint 1.74.0 tools
  separately from the root Vite Plus tools. The root `.pnpmfile.cjs` removes
  only Oxlint 1.74.0's optional Vite Plus peer, preventing its standalone suite
  from acquiring the root runner's incompatible Vitest coverage peers.
- Each ESLint fixture declares the real `eslint` package, not an alias. Versions
  are 8.57.1, 9.39.1, and 10.0.0. This corrects the imported v9 fixture's v10 alias.
  Injected workspace copies bind the plugin's peers to each fixture; pnpm syncs
  those copies after builds. Tests assert the binary and plugin peer paths before
  checking violations and file constraints.
- The automatic Git-hook `prepare` step remains removed. Root build approvals
  do not enable the imported hook installer. Existing hook configuration is not
  installed into the parent repository.
- Build and package validation use npm commands that also work when pnpm is
  accessed through Corepack. Publint still checks packed files, now via its CLI
  with `--pack npm`, rather than tsdown's implicit global `pnpm pack` call.
- Package lint permits explicit versions. Root lint/format preserves upstream
  style; `lint-packages` runs the plugin's own ESLint check.

ESLint, its parser, rule-testing tools, and peer dependencies remain required
for this ESLint product, regardless of the root repository's use of Oxlint.
Copied package-local `.github/` workflows are upstream reference files, not
active monorepo workflows.

## Validation

Run from the monorepo root with Node 24 and the root-pinned pnpm via Corepack:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm --filter eslint-plugin-roblox-ts run typecheck
corepack pnpm --filter eslint-plugin-roblox-ts run lint
corepack pnpm --filter eslint-plugin-roblox-ts run test --run
corepack pnpm --filter eslint-plugin-roblox-ts run test:fixtures
```

Root `test-packages` runs the typecheck, Vitest suite, and compatibility fixtures
in that order. Run suites sequentially because Oxlint tests can rebuild `dist/`,
which compatibility fixtures load. Run a root build after source changes so
pnpm refreshes the injected copies before fixture testing.
