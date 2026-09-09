# Upstream import

Imported from [roblox-ts/eslint-plugin-roblox-ts](https://github.com/roblox-ts/eslint-plugin-roblox-ts)
at commit `e1581d4f3d83a3d05b015a0a216507c3a20016de` (package version `1.4.1`).
The upstream MIT license, public exports, configs, rules, documentation, tests,
fixtures, and development scripts are preserved.

## Local packaging

- The package manifest uses the upstream catalog versions explicitly so the
  parent workspace does not need to define those catalogs. Fixture catalogs
  remain in the package-local workspace.
- The package-local lockfile retains upstream dependency resolutions, with only
  the root importer's dependency specifiers adjusted.
- The automatic `prepare` hook is removed to avoid modifying the parent
  repository's Git hooks. The upstream hook configuration is otherwise retained.
- Package lint permits explicit versions in `package.json`.
- ESLint, its parser, rule-testing tools, and peer dependencies remain required
  for this ESLint product, regardless of the parent repository's use of Oxlint.

The root lockfile, scripts, and CI are intentionally untouched. This import does
not yet integrate the package into root frozen installs or validation commands.
The nested workspace supports independent validation. The copied `.github/`
workflows are upstream reference files, not active monorepo workflows.

## Validation

Run from the monorepo root using pnpm 10.22.0 and Node 24:

```sh
pnpm --dir packages/eslint-plugin-roblox-ts install --frozen-lockfile --ignore-scripts
pnpm --dir packages/eslint-plugin-roblox-ts run build
pnpm --dir packages/eslint-plugin-roblox-ts run typecheck
pnpm --dir packages/eslint-plugin-roblox-ts run lint
pnpm --dir packages/eslint-plugin-roblox-ts run test --run
pnpm --dir packages/eslint-plugin-roblox-ts run test:fixtures
```

Run the test suite and compatibility fixtures sequentially: the Oxlint tests
rebuild `dist/`, which the compatibility fixtures load.

Upstream's `eslint-v9` fixture currently installs the `eslint-10` alias. The
package's own ESLint is 9.39.1; to also test that fixture against ESLint 9:

```sh
pnpm --dir packages/eslint-plugin-roblox-ts/fixtures/eslint-v9 exec node ../../node_modules/eslint/bin/eslint.js 'src/**/*.ts' --format json
```

That direct lint command intentionally exits with status 1 because the fixture
contains rule violations. Its JSON output must contain `roblox-ts/` diagnostics
rather than configuration or parsing failures.
