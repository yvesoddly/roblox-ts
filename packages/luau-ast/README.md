# @roblox-ts/luau-ast

Luau AST construction and rendering for roblox-ts. This workspace package is published independently
as `@roblox-ts/luau-ast`; the compiler uses it through `workspace:*`.

Imported from [roblox-ts/luau-ast v2.1.0](https://github.com/roblox-ts/luau-ast/tree/v2.1.0),
commit `836ce92` (see `LICENSE` for the upstream MIT license).

Run `pnpm build` from the repository root to build the workspace in dependency order.
`pnpm test` exercises the local AST and renderer through compiler snapshots, diagnostics, and runtime tests.
To pack this package separately, run `pnpm --filter @roblox-ts/luau-ast pack`.

The Publish workflow has a package selector. Before publishing this package from the monorepo,
its npm trusted publisher must point to this repository's `Publish.yml` workflow. Publish a new
renderer version before a compiler release that depends on it. Package releases use `luau-ast-v<version>` tags.
