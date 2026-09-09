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

Run from the repository root with Node.js 22 or newer:

```sh
npm install --prefix packages/rojo-resolver --workspaces=false --package-lock=false --ignore-scripts
npm --prefix packages/rojo-resolver run build
npm --prefix packages/rojo-resolver test
```

The isolated install avoids changing the workspace lockfile. Once workspace dependencies
are installed, `pnpm --filter @roblox-ts/rojo-resolver build` and
`pnpm --filter @roblox-ts/rojo-resolver test` run the same scripts.

Upstream 1.2.0 contains no standalone tests or fixtures. Its
[UnitTests workflow](https://github.com/roblox-ts/rojo-resolver/blob/f781b43e3d21cc2c075aa88022dfb542da42e908/.github/workflows/UnitTests.yml)
installs the resolver into roblox-ts and runs the compiler's full `npm test` suite.
Those existing compiler tests remain in the workspace. The package-local Node tests
exercise the built package entry point, schema loading, path resolution, script types,
network boundaries, and relative paths.

Workspace integration still requires changes outside this directory:

- Change `packages/roblox-ts/package.json` to depend on this package via `workspace:*`
  and regenerate `pnpm-lock.yaml` to link the compiler to it. The package importer
  is already included for frozen workspace installs.
- Add this package to root TypeScript project references and to the compiler's project
  references where needed for direct project builds. Recursive pnpm builds already
  discover it through `packages/*`.
- Include this package's test command in the root test/CI flow. The root Jest configuration
  does not discover these Node tests. Run the existing compiler integration suite against
  the workspace-linked resolver.
