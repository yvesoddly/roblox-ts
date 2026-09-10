# create-roblox-ts

Create a roblox-ts project from a template:

```sh
npm create roblox-ts@latest game -- --dir my-game -y
```

Templates: `game` (`place` alias), `model`, `plugin`, and `package`. Run
`create-roblox-ts --help` for compiler version, package manager, configuration,
and build options.

## Local development

From the repository root, with Node.js 24 and Corepack:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter create-roblox-ts test
npm --prefix packages/create-roblox-ts run test:integration
```

The root `corepack pnpm run build` and `corepack pnpm run test-packages` commands
also build and test this package. Its TypeScript compiler stays on `~5.2.2`, with
Node-only ambient types so the root compiler's 5.9 declarations do not leak in.

`test` builds the CLI and checks generation, package-manager commands, option
handling, and overwrite protection offline. Only external commands are stubbed;
the CLI and template copying run against temporary directories.

`test:integration` packs and installs the generator in a temporary directory,
then generates and builds all five project types with recommended options and
npm. This ports upstream's CI matrix into a locally runnable test and requires
network access. Generated projects use current registry dependencies, not the
workspace compiler. Both suites clean up their temporary projects.

## Import and integration boundary

Imported from `roblox-ts/create-roblox-ts` at
`b593a4bca4a9f6b2c04c0a396ff0d02b7629537d` (version `2.0.5`). The source,
templates, license, command name, package name, version, runtime dependencies,
and publish file list are preserved. TypeScript `~5.2.2`, matching upstream's
locked compiler version, is now an explicit development dependency instead of
an incidental peer dependency. Package-local tests replace the upstream
GitHub Actions generation matrix; workflows are not installed under a package.
Upstream npm lockfiles are omitted in favor of the repository's shared pnpm lockfile.

The root workspace explicitly includes this package and its development link.
One root lockfile covers installation; root package tests run in the existing
Linux/Windows unit-test CI. Imported source formatting and package-local ESLint
checks are retained rather than applying compiler-specific formatting rules.

For generated consumers of the local workspace, use the separate root command
`corepack pnpm run test-toolchain` after a root build. It defaults to the `game`
template; `RBXTS_TEMPLATE_TYPE` selects `game`, `place`, `model`, `plugin`, or
`package`. This network-dependent check is separate from `pnpm test` and from the
registry-based `test:integration` suite above. Registry generation installs
`roblox-ts`, which includes the `rbxtsc` binary. The local workspace consumer test
explicitly installs the separate `@roblox-ts/cli` tarball; that package is not
available from the registry. The `--compilerVersion` mapping remains unchanged.

The package template declares `main: "out/init.luau"` for current compilers and
retains `out/init.lua` for `--compilerVersion` pins below 3.0.0. The registry
integration test requires both the declared runtime and type entry points to exist.

Generated projects use ESLint 8.57.1 so their `.eslintrc` works without a flat-config
migration or environment override. Broader dependency modernization is separate
from this import. The local generator dependency install reported six high-severity
npm audit findings; no automatic audit fixes were applied.
