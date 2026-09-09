# @roblox-ts/path-translator

Maps TypeScript source paths to compiled Luau, declaration, transformed-source, and import paths for roblox-ts.

Imported from [roblox-ts/path-translator v1.1.0](https://github.com/roblox-ts/path-translator/tree/2e6f341b51f5ecc5b4f152903e7b5cfb60c4ad7e)
(commit `2e6f341b51f5ecc5b4f152903e7b5cfb60c4ad7e`). The source, MIT license, and changelog are unchanged.
The package remains `@roblox-ts/path-translator@1.1.0`, with its CommonJS entry point at `out/PathTranslator.js`.

## Local development

From the repository root, install only this package's dependencies without changing the workspace lockfile:

```sh
npm --prefix packages/path-translator install --workspaces=false --package-lock=false
npm --prefix packages/path-translator run build
npm --prefix packages/path-translator test
```

The build uses TypeScript 5.9.3 directly. Upstream's path-transform plugin is unnecessary because all source imports
already use relative paths. Tests use Node's built-in test runner against the built package entry point.

The upstream tag contains no standalone test files. Its `UnitTests.yml` workflow installs the package into a separate
roblox-ts checkout and runs that compiler's full test suite. The local tests cover the public path-mapping API;
compiler integration remains a separate workspace check.

## Workspace integration follow-up

- Change `packages/roblox-ts/package.json` to consume `@roblox-ts/path-translator` via `workspace:*` and regenerate
  the lockfile to test the compiler against this local source.
- Include this package's tests in the root test command or CI; the root Jest configuration does not discover them.
- Add a reference in the root `tsconfig.json` if root TypeScript project builds should include this package.

The existing `packages/*` workspace glob and recursive build command already discover this package.
