# @roblox-ts/rojo-resolver

Rojo project resolution for roblox-ts.

Imported from [roblox-ts/rojo-resolver v1.2.0](https://github.com/roblox-ts/rojo-resolver/tree/f781b43e3d21cc2c075aa88022dfb542da42e908).
The tag and npm's `gitHead` both identify commit `f781b43e3d21cc2c075aa88022dfb542da42e908`.
The MIT license and changelog are unchanged from that commit. Local fixes cover config
discovery, missing and malformed configs, directory cycles, and path-prefix checks.
The package retains its name, version, CommonJS entry point, and public API.

Build tooling uses the workspace's TypeScript 5.9.3 with plain `tsc`; this source has no
imports requiring path transformation. ES2022 library declarations cover the existing
`Array.at` call while emitted JavaScript retains the upstream ES2019 target.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @roblox-ts/rojo-resolver run build
pnpm --filter @roblox-ts/rojo-resolver test
```

Upstream 1.2.0 contains no standalone tests or fixtures. Its
[UnitTests workflow](https://github.com/roblox-ts/rojo-resolver/blob/f781b43e3d21cc2c075aa88022dfb542da42e908/.github/workflows/UnitTests.yml)
installs the resolver into roblox-ts and runs the compiler's full `npm test` suite.
Those existing compiler tests remain in the workspace. The package-local Node tests
exercise the built package entry point, schema loading, path resolution, script types,
network boundaries, and relative paths.

## Workspace integration

The compiler consumes this package through `workspace:*`. Root builds and the CLI watch build include its
TypeScript project. `pnpm run test-packages` runs its public API tests; `pnpm test` also validates the compiler
against the local package. Template and playground CI install the packed local dependency.

Publish a changed version before releasing a compiler that depends on its new behavior or API.
