# @roblox-ts/path-translator

Maps TypeScript source paths to compiled Luau, declaration, transformed-source, and import paths for roblox-ts.

Imported from [roblox-ts/path-translator v1.1.0](https://github.com/roblox-ts/path-translator/tree/2e6f341b51f5ecc5b4f152903e7b5cfb60c4ad7e)
(commit `2e6f341b51f5ecc5b4f152903e7b5cfb60c4ad7e`). The source, MIT license, and changelog are unchanged.
The package remains `@roblox-ts/path-translator@1.1.0`, with its CommonJS entry point at `out/PathTranslator.js`.

## Local development

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @roblox-ts/path-translator run build
pnpm --filter @roblox-ts/path-translator test
```

The build uses TypeScript 5.9.3 directly. Upstream's path-transform plugin is unnecessary because all source imports
already use relative paths. Tests use Node's built-in test runner against the built package entry point.

The upstream tag contains no standalone test files. Its `UnitTests.yml` workflow installs the package into a separate
roblox-ts checkout and runs that compiler's full test suite. The local tests cover the public path-mapping API;
compiler integration remains a separate workspace check.

## Workspace integration

The compiler consumes this package through `workspace:*`. Root builds and the CLI watch build include its
TypeScript project. `pnpm run test-packages` runs its public API tests; `pnpm test` also validates the compiler
against the local package. Template and playground CI install the packed local dependency.

Publish a changed version before releasing a compiler that depends on its new behavior or API.
