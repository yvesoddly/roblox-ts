# @rbxts/compiler-types

The compiler's ambient TypeScript declarations, imported from
[roblox-ts/compiler-types](https://github.com/roblox-ts/compiler-types/tree/314b208523e7d16231cb22ddf26dc0af234bab85)
at commit `314b208523e7d16231cb22ddf26dc0af234bab85`. The upstream MIT license is preserved in `LICENSE`.

This is a private workspace package for this fork. Its existing name and version are retained because
roblox-ts recognizes the declarations as `@rbxts/compiler-types`. No npm publishing setup is required.

Edit `types/*.d.ts` directly. No build or generated JavaScript is needed. `pnpm test` checks the local
declarations and exercises them through the compiler's snapshots, diagnostics, and runtime tests. Shared TypeScript and Roblox types
used for declaration checking are development dependencies of the workspace root.

`pnpm run update-test-types` refreshes only the external `@rbxts/types` dependency. It leaves this
workspace package in place. To try these declarations in another project without publishing, run
`pnpm --filter @rbxts/compiler-types pack` and install the resulting tarball in that project.
