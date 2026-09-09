# Contributing

Thank you for your interest in contributing to **roblox-ts**!

## Getting Started

First, we'll need to setup the development build of **roblox-ts**.

This guide assumes you have the following installed:

- Git
- NodeJS 24.11.0 or newer
- pnpm 11.25.0 (the version pinned in `package.json`)

We'll also assume you understand some basic terminal navigation commands (`cd`, `ls`/`dir`, etc.).

The repository is a pnpm workspace. `packages/roblox-ts` contains the published compiler,
`packages/cli` contains the `@roblox-ts/cli` command line package,
`packages/luau-ast` contains the AST and renderer, `packages/compiler-types` contains their companion
compiler declarations, and `tests` contains the private Roblox runtime test project,
and `devlink` provides the development CLI.
Run the commands below from the repository root; one install sets up all packages.

1. Begin by creating a fork of roblox-ts.

![https://i.imgur.com/wRtbuiy.png](https://i.imgur.com/wRtbuiy.png)

2. Navigate to somewhere you'd like to keep your development copy of **roblox-ts** and then you can run the following commands:

```sh
# Clone your fork of roblox-ts (you may prefer to use SSH instead)
git clone https://github.com/YOUR_GITHUB_USERNAME/roblox-ts.git
# Navigate into the roblox-ts folder
cd roblox-ts
# Install dependency packages (node_modules)
pnpm install --frozen-lockfile
# build the compiler
pnpm run build
# link
pnpm run devlink
```

3. You should now be able to use the command `rbxtsc-dev` to run the development compiler!

4. At a later time, if you need to update it:

```sh
# pull latest changes
git pull
# build the compiler
pnpm run build
```

It is not necessary to run the "devlink" script again.

## Linting and Formatting

Vite Plus is a local workspace dependency. Run `pnpm run check` to lint with Oxlint and check
formatting with Oxfmt, or `pnpm run fmt` to apply formatting. Both use the root `vite.config.ts`.
The config retains type-aware linting and the import-sort and suppression-comment plugins.
Node and pnpm are managed separately; no global Vite Plus installation is needed.

The compiler build still uses TypeScript 5.9 and `tspc`; the tests still use Jest, Rojo, and Lune.
The explicit paths in the TypeScript configs also support Oxlint's TypeScript Go engine.
Install the recommended Oxc VS Code extension and copy `.vscode/settings.example.json` to
`.vscode/settings.json` for matching editor behavior.

## Unit Testing

**roblox-ts** keeps a suite of automated unit tests inside of `/tests`.

The tests run in two environments:

- `tests/compiler/` contains Node/Jest tests for compiler behavior and exact Luau output.
  Expected output is stored in Jest's `__snapshots__/` directories.
- `tests/src/` is a tiny **roblox-ts** game containing runtime tests, diagnostic cases,
  and supporting fixtures. It has a separate TypeScript configuration from the Node tests.

Prefer source-level runtime tests for behavior and diagnostic tests for invalid source.
Use emit snapshots to verify output quality that runtime assertions cannot observe,
such as unnecessary temporary variables. Avoid testing transformer internals in isolation.

The testing process is as follows:

1. Run Jest to check compiler behavior, verify snapshots, and compile the Roblox test project into `tests/out`
2. Use `rojo build` to create `tests/test.rbxl`
3. Use `lune` to execute the runtime tests

You can run this process yourself if you have [rokit](https://github.com/rojo-rbx/rokit) installed.

```sh
# install rojo + lune
rokit install
# Compile tests, build .rbxl, run with lune
pnpm test
```

After building the compiler, you can also run just the Jest tests with `pnpm run test-compile`.
For an intentional emit change, update snapshots with `pnpm run test-compile --updateSnapshot`
and review the resulting diff before committing.

Normal test runs use the versions and Git commits recorded in `pnpm-lock.yaml`. To intentionally refresh
the external Roblox types, run `pnpm run update-test-types` and review the manifest and lockfile changes.
Compiler declarations come from the private local `packages/compiler-types` package; edit them directly.

To build a distributable compiler tarball, run `pnpm --filter roblox-ts pack`. The package keeps its
Node entry point, browser entry point, and bundled runtime files. Pack `@roblox-ts/cli` separately
with `pnpm --filter @roblox-ts/cli pack` to distribute the `rbxtsc` command. CLI users install
`@roblox-ts/cli`, which depends on the compiler.

The compiler references the local `@roblox-ts/luau-ast` package. Root builds run in dependency order,
and `pnpm run build-watch` watches the CLI, compiler, and AST packages through TypeScript project references. Jest also loads
the AST and renderer source directly, so compiler tests cover changes in either package.

Always pack with pnpm before publishing: it replaces `workspace:*` dependencies with package versions.
The Publish workflow does this automatically and supports each package. See
[the luau-ast package notes](packages/luau-ast/README.md) for its release setup.
