# create-roblox-ts

Create a roblox-ts project from a template:

```sh
npm create roblox-ts@latest game -- --dir my-game -y
```

Templates: `game` (`place` alias), `model`, `plugin`, and `package`. Run
`create-roblox-ts --help` for compiler version, package manager, configuration,
and build options.

## Local development

From the repository root, with Node.js 22 or newer for the tests:

```sh
npm install --prefix packages/create-roblox-ts --package-lock=false
npm --prefix packages/create-roblox-ts test
npm --prefix packages/create-roblox-ts run test:integration
```

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

Follow-up work outside this package is deliberately not included:

- Refresh the root `pnpm-lock.yaml` before using a frozen workspace install.
  The existing `packages/*` workspace glob already discovers this package.
- Add this package's tests to the root test scripts and CI, including Windows
  coverage from upstream. Root compiler tests do not run these Node tests.
- Decide how generated projects consume the split compiler and CLI. Generation
  still installs the published `roblox-ts` and `@rbxts/compiler-types` packages
  and invokes `rbxtsc`. The workspace's `roblox-ts` package no longer owns that
  binary; `@roblox-ts/cli` does, and compiler declarations are private here.
  Adopting workspace builds requires coordinated dependency/version changes,
  including the `--compilerVersion` mapping to `compiler-X.X.X` declaration tags.
- Wire package publication into monorepo release automation. The existing
  `prepublishOnly` build and upstream repository metadata remain unchanged.

### Known upstream limitation

Local generation with current registry dependencies successfully compiled all
five project types, but the package template still declares `main: "out/init.lua"`
while the installed compiler emits `out/init.luau`. The integration test reports
this mismatch without changing the upstream generation/build contract. A passing
build does not establish that the generated package's entry point resolves.
Correcting the entry point is a separate behavior change.

Dependency modernization, including the generated legacy ESLint configuration,
is separate from this behavior-preserving import. The local generator dependency
install reported six high-severity npm audit findings; no dependency upgrades or
automatic audit fixes were applied.
