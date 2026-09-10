# Local generated-project toolchain

From the repository root, with Corepack on `PATH` and a supported Node version
(CI uses Node 24):

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm run test-toolchain
RBXTS_TEMPLATE_TYPE=package corepack pnpm run test-toolchain
```

The last command uses POSIX shell syntax. In PowerShell, set
`$env:RBXTS_TEMPLATE_TYPE = "package"` before running the test command.

The entrypoint is `node --test tests/toolchain/localToolchain.test.cjs`. It defaults
to `game`; `RBXTS_TEMPLATE_TYPE` also accepts `place`, `model`, `plugin`, and
`package`. `TestTemplateProject.yml` runs all five selections using this same test.
Run selections sequentially locally because packing runs compiler build hooks.
The test bootstraps the workspace's pinned pnpm through Corepack and creates
short-lived shims for the generator's subprocesses. It does not need global pnpm
or change the user's shell configuration. Temporary pnpm configuration disables
`init`'s automatic pin to the registry's latest pnpm, keeping subprocesses on the
workspace version.

The test packs and installs the local generator, compiler, split CLI, compiler
declarations, AST, path translator, Rojo resolver, and ESLint plugin. Temporary
pnpm overrides cover both direct and transitive dependencies, including the
generator's initial dependency installation. Installed runtime files are compared
with this checkout, following the CLI's and plugin's dependency resolution rather
than checking versions alone. Hoisted temporary installs preserve the templates'
`node_modules/@rbxts` type roots.

The generated project gets the split CLI and a focused flat ESLint configuration,
not the generator's legacy ESLint setup. A numeric condition appended to template
source must produce the plugin's type-aware `lua-truthiness` diagnostic. After
making the condition explicit, lint must pass and the installed CLI must emit the
expected Luau. Application templates must copy the local runtime and Promise
library; the package template must emit its public declaration. The CLI entrypoint
comes from its installed package manifest, so neither `npx` nor a global or
parent-workspace compiler can satisfy the build. This checks compilation and lint
integration, not Roblox runtime behavior or the package template's published
entrypoint metadata.

Network access is required for third-party dependencies. Direct TypeScript,
Roblox types, ESLint, and parser versions match the installed workspace versions;
their registry dependency trees are resolved in the temporary projects, not from
the workspace's frozen lockfile. No packages are published. Tarballs, installations,
generated projects, and the temporary pnpm store are removed in `finally`.
